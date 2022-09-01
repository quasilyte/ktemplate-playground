namespace App {
    const snippets = {
        'Welcome': {
            'src': `
{#
    Welcome to the KTemplate playground!
    You can edit and explore templates here.
#}

Here are some example expressions for you:
{{ a.b.c }}
{{ a|length }}
{{ "Hello, " ~ "World" }}
{{ "5293" matches \`/\\d+/\` }}

Note that a.b.c comes from the template data.

You can declare and modify template-local variables:
{% let $v = 5.1 %}
{{ $v * 2 }}
{% set $v = $v / 2 %}
{{ $v }}
            `.trim(),
            'data': '{"a": {"b": {"c": 10}}}',
        },
        'Multi file': {
            'src': `
--- main.template
{# It's possible to use multi-file templates #}
{# Use --- followed by a file name #}
{% include "ui/button.template" %}
    {% arg $name = "example" %}
{% end %}

--- ui/button.template
{% param $name = "button" %}
{% param $label = "" %}
{% if $label %}
<label>
    {{$label}}:
    <input id="ui-{{$name}}" type="button" value="{{$name}}">
</label>
{% else %}
    <input id="ui-{{$name}}" type="button" value="{{$name}}">
{% end %}
            `.trim(),
            'data': '{}',
        },
        'For loop': {
            'src': `
Loop over values:
{% for $item in page.items %}
    {{ $item['name'] }}
{% end %}

Loop over keys and values:
{% for $i, $item in page.items %}
    {{ $i ~ ": " ~ $item['name'] }}
{% end %}
            `.trim(),
            'data': '{"page": {"items": [{"name": "Bidon Pomoev"}, {"name": "Rulon Oboev"}]}}',
        },
        'Escape/raw': {
            'src': `
{% let $html = '<i>boom</i>' %}

This sandox uses auto-escaping for HTML:
{{ $html }}

It's possible to output the value "as is":
{{ $html|raw }}

Like in Twig, you can apply the escaping manually:
{{ $html|escape }}
Escape filter is aliased to "e" for convenience.

It's also possible to choose the escaping strategy:
{{ "Status: OK"|e("url") }}
            `.trim(),
            'data': '{}',
        },
        'Block assign': {
            'src': `
--- child.template
{% let $content %}
    This is our custom content.
    Try removing the arg tag to see the default content.
{% end %}

{% include "base.template" %}
    {% arg $content = $content %}
    {% arg $title %}My super title{% end %}
{% end %}

--- base.template
{% param $title = "Default Title" %}
{% param $content %}
    This is some default content.
    {# It's possible to use tags here too #}
    (The title is "{{ $title }}")
{% end %}

<h1>{{ $title }}</h1>
Page content is:
{{ $content|raw }}
            `.trim(),
            'data': '{}',
        },
        'Builtins': {
            'src': `
{% let $s = '432' %}
{% if starts_with($s, '4') %}
    Capitalized={{ 'alex'|capitalize }}
{% end %}
{{ languages|first|first }}
{{ languages|first }}
{{ languages|last }}
{{ languages|keys|first }}
            `.trim(),
            'data': '{"languages": ["KPHP", "PHP"]}',
        },
        'Whitespace control': {
            'src': `
With "-" tag modifier you can control the whitespaces

Every loop iteration produces exactly 1-line output:

{% for $name, $v in prices -%}
    {{ $name }}: {{ $v -}}
    {% if $v > 100000 %} (WOW! That's a lot!){% end %}
{% end %}
            `.trim(),
            'data': '{"prices": {"laptop": 65020, "apple": 50, "compiler": 248184271}}',
        },
    };

    let $templateSource: HTMLTextAreaElement = null;
    let $templateData: HTMLInputElement = null;
    let $templateResult: HTMLSpanElement = null;
    let $snippetSelector: HTMLSelectElement = null;
    let $renderButton: HTMLInputElement = null;
    let $disasmButton: HTMLInputElement = null;

    function setSnippet(name: string) {
        let snippet = snippets[name];
        $templateSource.value = snippet.src;
        $templateData.value = snippet.data;
    }

    function showErrorResult(message: string) {
        $templateResult.textContent = "error!\n" + message;
    }

    function apiRequest(route: string, data: any) {
        $renderButton.disabled = true;
        $disasmButton.disabled = true;

        fetch(route, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        })
        .then(resp => resp.json())
        .then(resp => {
            if ('error' in resp) {
                showErrorResult(resp.error);
            } else if ('result' in resp) {
                $templateResult.textContent = resp.result;
            } else {
                showErrorResult('unexpected respons from the server');
            }
            $renderButton.disabled = false;
            $disasmButton.disabled = false;
        });
    }

    function renderTemplate() {
        if (!$templateSource.value) {
            $templateResult.textContent = '';
            return;
        }
        if ($templateSource.value.length > 2048) {
            showErrorResult('template source is too big');
            return;
        }
        if ($templateData.value.length > 512) {
            showErrorResult('template data is too big');
            return;
        }
        let decodedData = {};
        try {
            decodedData = JSON.parse($templateData.value);
        } catch (e) {
            showErrorResult(e.message);
            return;
        }
        apiRequest('/ktemplate/api/render', {
            'source': $templateSource.value,
            'data': decodedData,
        });
    }

    function disasmTemplate() {
        if (!$templateSource.value) {
            $templateResult.textContent = '  RETURN';
            return;
        }
        if ($templateSource.value.length > 2048) {
            showErrorResult('template source is too big');
            return;
        }
        apiRequest('/ktemplate/api/disasm', {
            'source': $templateSource.value,
        });
    }

    export function main() {
        $templateSource = document.getElementById('templatesource') as HTMLTextAreaElement;
        $templateData = document.getElementById('templatedata') as HTMLInputElement;
        $templateResult = document.getElementById('templateresult') as HTMLSpanElement; 
        $snippetSelector = document.getElementById('snippetselect') as HTMLSelectElement;
        $renderButton = document.getElementById('renderbutton') as HTMLInputElement;
        $disasmButton = document.getElementById('disasmbutton') as HTMLInputElement;

        $templateResult.textContent = ``;

        for (let key in snippets) {
            let option = document.createElement('option');
            option.value = key;
            option.innerHTML = key;
            $snippetSelector.appendChild(option);
        }

        $renderButton.addEventListener('click', function () {
            renderTemplate();
        });
        $disasmButton.addEventListener('click', function () {
            disasmTemplate();
        });

        $snippetSelector.addEventListener('change', function() {
            setSnippet(this.value);
        });

        setSnippet($snippetSelector.options[$snippetSelector.selectedIndex].value);
    }
}

window.onload = function() { 
    App.main();
};
