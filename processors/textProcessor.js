module.exports = (text, type, options) => {
    // 열고닫는 문자 변수에 저장
    let styles = {
        "'''": "strong",
        "''": "italic",
        "--": "strike",
        "~~": "strike",
        "__": "underline",
        "^^": "superscript",
        ",,": "subscript"
    }
    switch(type) {
        case "'''":
        case "''":
        case "--":
        case "~~":
        case "__":
        case "^^":
        case ",,":
            return [{name: `${styles[type]}-start`}, {name: "wikitext", parseFormat: true, text: text}, {name: `${styles[type]}-end`}];
        case "{{{":
            // 삼중괄호
            if(text.startsWith('#!html')) {
                // 인라인 HTML
                return [{name: "unsafe-plain", text: text.substring(6)}];
            } else if(/^#([A-Fa-f0-9]{3,6}) (.*)$/.test(text)) {
                // 글자색
                let matches = /^#([A-Fa-f0-9]{3,6}) (.*)$/.exec(text);
                if(matches[1].length === 0 && matches[2].length === 0)
                    return [{name: "plain", text: text}];
                return [{name: "font-color-start", color: matches[1]}, {name: "wikitext", parseFormat: true, text: matches[2]}, {name: "font-color-end"}];
            } else if(/^\+([1-5]) (.*)$/.test(text)) {
                // 글자크기
                let matches = /^\+([1-5]) (.*)$/.exec(text);
                return [{name: "font-size-start", level: matches[1]}, {name: "wikitext", parseFormat: true, text: matches[2]}, {name: "font-size-end"}];
            };
            // 리터럴
            return [{name: "monoscape-font-start"}, {name: "plain", text: text}, {name: "monoscape-font-end"}]
        case "@":
            // 틀 변수
            if(!options.included)
                break;
            if(Object.keys(options.includeParameters).indexOf(text) != -1)
                return [{name: "wikitext", parseFormat: true, text: options.includeParameters[text]}];
            else
                return null;
    }
    return [{name: "plain", text: `${type}${text}${type}`}];
}
