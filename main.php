<?php

require_once __DIR__ . '/vendor/autoload.php';

use KTemplate\Template;
use KTemplate\Context;
use KTemplate\Engine;
use KTemplate\ArrayLoader;
use KTemplate\ArrayDataProvider;
use KTemplate\FilterLib;
use KTemplate\FunctionLib;
use KTemplate\Internal\Compile\CompilationException;

// Notable things that could go into the web framework:
// * request flow pipeline with middlewares support
// * logger
// * routing helpers
// * response handling (content type, etc)
// * static files serving (KPHP can't serve static files automatically right now)

/**
 * @return string|false
 */
function main() {
    $c = new Controller();
    
    $request_uri = (string)$_SERVER['REQUEST_URI'];
    $request_method = (string)$_SERVER['REQUEST_METHOD'];

    if (str_starts_with($request_uri, '/ktemplate')) {
        $request_uri = substr($request_uri, strlen('/ktemplate'));
    }
    
    $request_route = parse_url($request_uri, PHP_URL_PATH);
    if ($request_route !== '/') {
        $request_route = rtrim($request_route, '/');
    } else {
        $request_route = '/index.html';
    }

    if (!str_starts_with($request_route, '/api')) {
        // For PHP dev webserver only.
        return false;
    }

    /** @var (callable():string)[] $post_routes */
    $post_routes = [
        '/api/render' => [$c, 'handleRender'],
        '/api/disasm' => [$c, 'handleDisasm'],
    ];
    /** @var (callable():string)[] $get_routes */
    $get_routes = [
        '/api/info' => [$c, 'handleInfo'],
    ];

    /** @var (callable():string)[][] $all_routes */
    $all_routes = [
        'POST' => $post_routes,
        'GET' => $get_routes,
    ];
    if (!isset($all_routes[$request_method])) {
        return "unsupported request method: $request_method";
    }
    $routes = $all_routes[$request_method];
    if (isset($routes[$request_route])) {
        $handler = $routes[$request_route];
        return $handler();
    }
    return 'unknown route';
}

class Controller {
    public function handleRender() {
        $request_data = $this->decodeRequestData();
        if (strlen($request_data['source']) >= 2048) {
            $this->jsonResponse(['error' => 'template source is too big']);
            return '';
        }
        $file_set = $this->createFileSet((string)$request_data['source']);

        $engine = $this->newEngine($file_set);
        $data_provider = new ArrayDataProvider($request_data['data']);
        
        $main_template = (string)array_first_key($file_set);
        $response = [];
        try {
            $response['result'] = $engine->render($main_template, $data_provider);
        } catch (CompilationException $e) {
            $response['error'] = $e->getFullMessage();
        }

        $this->jsonResponse($response);
        return '';
    }

    public function handleDisasm() {
        $request_data = $this->decodeRequestData();
        if (strlen($request_data['source']) >= 2048) {
            $this->jsonResponse(['error' => 'template source is too big']);
            return '';
        }
        $file_set = $this->createFileSet((string)$request_data['source']);

        $engine = $this->newEngine($file_set);

        $main_template = (string)array_first_key($file_set);
        $response = [];
        try {
            $t = $engine->getTemplate($main_template);
            $disasm = $engine->disassembleTemplate($t, 24);
            $response['result'] = implode("\n", $disasm);
        } catch (CompilationException $e) {
            $response['error'] = $e->getFullMessage();
        }

        $this->jsonResponse($response);
        return '';
    }

    public function handleInfo() {
        $this->jsonResponse([
            'kphp_version' => KPHP_COMPILER_VERSION,
        ]);
        return '';
    }

    /** @param mixed $data */
    private function jsonResponse($data) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data);
    }

    private function newEngine($file_set) {
        $ctx = new Context();
        $loader = new ArrayLoader($file_set);
        $engine = new Engine($ctx, $loader);
        FilterLib::registerAllFilters($ctx, $engine);
        FunctionLib::registerAllFunctions($ctx, $engine);
        return $engine;
    }

    /**
     * @param string $src
     */
    private function createFileSet($src) {
        $parts = preg_split("/--- ([\w\/]+\.\w+)\n/", $src, -1, PREG_SPLIT_DELIM_CAPTURE|PREG_SPLIT_NO_EMPTY);
        $file_set = [];
        if (count($parts) === 1) {
            $file_set['main.template'] = (string)$parts[0];
        } else {
            for ($i = 0; $i < count($parts); $i += 2) {
                $file_set[(string)$parts[$i]] = (string)$parts[$i+1];
            }
        }
        return $file_set;
    }

    private function decodeRequestData() {
        return json_decode(file_get_contents('php://input'), true);
    }
}

$result = main();
if ($result === false) {
    return false; // Let the PHP webserver serve this request
}
if (is_string($result) && $result) {
    file_put_contents('php://stderr', date('H:m:s') . ": request error: $result\n");
}
