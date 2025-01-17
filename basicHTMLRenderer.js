const encodeHTMLComponent = require('htmlspecialchars'),
      moment = require('moment'),
      extend = require('extend'),
      async = require('async'),
      Namumark = require(__dirname + '/index');
let defaultOptions = {
    wiki: {
        exists: (title, isImage) => {return true;},
        includeParserOptions: {},
        // URL 처리
        resolveUrl: (target, type) => {
            switch(type) {
                case 'wiki':
                    return `/wiki/${target}`
                    break;
                case 'internal-image':
                    return `/file/${target}`
                    break;
            }
        }
    }
};

function HTMLRenderer(_options) {
    let resultTemp = [],
        options = extend(true, defaultOptions, _options),
        headings = [],
        footnotes = [],
        categories = [],
        links = [],
        isHeadingNow = false,
        isFootnoteNow = false,
        lastHeadingLevel = 0,
        hLevels = {1:0,2:0,3:0,4:0,5:0,6:0},
        footnoteCount = 0,
        headingCount = 0,
        lastListOrdered = [],
        wasPreMono = false;
    function appendResult(value) {
        // resultTemp 배열에 나무마크 배열 파싱 결과를 집어넣음
        if(isFootnoteNow) {
            // 각주[각주번호] 배열에 추가
            footnotes[footnotes.length - 1].value += typeof value === "string" ? value : value.toString();
            return;
        } else if(isHeadingNow) {
            // 목차[목차번호] 배열에 추가
            headings[headings.length - 1].value += typeof value === "string" ? value : value.toString();
        }
        if(resultTemp.length === 0)
            // resultTemp가 비어있을 때
            resultTemp.push(value);
        else {
            let isArgumentString = typeof value === "string";
            let isLastItemString = typeof resultTemp[resultTemp.length - 1] === "string";
            if(isArgumentString && isLastItemString) {
                  // value 변수가 string이고 resultTemp의 마지막 요소가 string일 때
                  // = 그냥 HTML 태그
                resultTemp[resultTemp.length - 1] += value;
            } else {
                resultTemp.push(value);
            }
        }
    }
    function ObjToCssString(obj) {
        // 배열에 들어있던 값 CSS 스트링으로 변환
        let styleString = "";
        for(let name in obj) {
            styleString += `${name}:${obj[name]}; `;
        }
        return styleString.substring(0, styleString.length - 1);
        // 변수에 스타일 스트링 전체 포함
    }
    let _ht = this;
    this.processToken = (i) => {
        // HTML 태그로 변환
        //console.log(i);
        switch (i.name) {
            case 'blockquote-start':
                appendResult('<blockquote>');
                break;
            case 'blockquote-end':
                appendResult('</blockquote>');
                break;
            case 'list-start':
                lastListOrdered.push(i.listType.ordered);
                appendResult(`<${i.listType.ordered ? 'ol' : 'ul'}${i.listType.type ? ` class="${i.listType.type}"` : ''}>`);
                break;
            case 'list-end':
                appendResult(`</${lastListOrdered.pop() ? 'ol' : 'ul'}>`);
                break;
            case 'indent-start':
                appendResult('<div class="wiki-indent">');
                break;
            case 'indent-end':
                appendResult('</div>');
                break;
            case 'list-item-start':
                appendResult(i.startNo ? `<li value=${encodeHTMLComponent(i.startNo)}>` : '<li>');
                break;
            case 'list-item-end':
                appendResult('</li>');
                break;
            case 'table-start':
                appendResult(`<table${i.options ? " style=\"" + ObjToCssString(i.options) +'"' : ''}>`);
                break;
            case 'table-col-start':
                appendResult(`<td${i.options ? " style=\"" + ObjToCssString(i.options) +'"' : ''}${i.colspan > 0 ? ` colspan=${i.colspan}` : ''}${i.rowspan ? ` rowspan=${i.rowspan}` : ''}>`);
                break;
            case 'table-col-end':
                appendResult('</td>');
                break;
            case 'table-row-end':
                appendResult('</tr>');
                break;
            case 'table-row-start':
                appendResult(`<tr${i.options ? " style=\"" + ObjToCssString(i.options) +'"' : ''}>`);
                break;
            case 'table-end':
                appendResult('</table>');
                break;
            case 'closure-start':
                appendResult('<div class="wiki-closure">');
                break;
            case 'closure-end':
                appendResult('</div>');
                break;
            case 'link-start':
                appendResult(`<a href="${i.internal ? options.wiki.resolveUrl(i.target, 'wiki') : i.target}" class="${i.internal ? 'wiki-internal-link' : ''}${i.external ? 'wiki-external-link' : ''}">`);
                break;
            case 'link-end':
                appendResult('</a>');
                break;
            case 'plain':
                appendResult(encodeHTMLComponent(i.text));
                break;
            case 'new-line':
                appendResult('<br>');
                break;
            case 'add-category':
                categories.push(i.categoryName);
                break;
            case 'image':
                appendResult(`<img src="${options.wiki.resolveUrl(i.target, 'internal-image')}"${i.fileOpts ? ` style=${ObjToCssString(i.fileOpts)}` : ''}></img>`)
                break;
            case 'footnote-start':
                let fnNo = ++footnoteCount;
                appendResult(`<a href="#fn-${fnNo}" id="afn-${fnNo}" class="footnote"><sup class="footnote-sup">[${i.supText ? i.supText : fnNo}] `)
                footnotes.push({sup: i.supText, value: ''});
                isFootnoteNow = true;
                break;
            case 'footnote-end':
                isFootnoteNow = false;
                appendResult('</sup></a>');
                break;
            case 'macro':
                switch (i.macroName) {
                    // 매크로 처리
                    case 'br':
                        appendResult('<br>');
                        break;
                    case 'dday':
                        if (i.options.length === 0 || typeof i.options[0] !== "string")
                            appendResult('<span class="wikitext-syntax-error">dday 매크로 : 매개변수가 없거나 익명 매개변수가 아닙니다.</span>');
                        else {
                            let mo = moment(i.options[0], 'YYYY-MM-DD')
                            if(!mo.isValid())
                                appendResult('<span class="wikitext-syntax-error">dday 매크로 : 날짜 형식이 잘못됐습니다.</span>')
                            else {
                                let days = -moment().diff(mo, 'days');
                                appendResult(days.toString())
                            }
                        }
                        break;
                    case 'age':
                        if (i.options.length === 0 || typeof i.options[0] !== "string")
                            appendResult('<span class="wikitext-syntax-error">age 매크로 : 매개변수가 없거나 익명 매개변수가 아닙니다.</span>');
                        else {
                            let mo = moment(i.options[0], 'YYYY-MM-DD')
                            let koreanWay = i.options.length > 1 && i.options.slice(1).indexOf('korean') !== -1;
                            if(!mo.isValid())
                                appendResult('<span class="wikitext-syntax-error">age 매크로 : 날짜 형식이 잘못됐습니다.</span>')
                            else {
                                let years = koreanWay ? moment().year() - mo.year() + 1 : moment().diff(mo, 'years');
                                appendResult(years.toString())
                            }
                        }
                        break;
                    case 'date':
                        appendResult(Date.toString());
                        break;
                    case 'youtube':
                        if (i.options.length == 0) {
                            appendResult('<span class="wikitext-syntax-error">오류 : youtube 동영상 ID가 제공되지 않았습니다!</span>')
                        } else if (i.options.length >= 1) {
                            if (typeof i.options[0] === 'string')
                                if (i.options.length == 1)
                                    appendResult(`<iframe src="//www.youtube.com/embed/${i.options[0]}"></iframe>`)
                            else
                                appendResult(`<iframe src="//www.youtube.com/embed/${i.options[0]}" style="${ObjToCssString(i.options.slice(1))}"></iframe>`)
                            else
                                appendResult('<span class="wikitext-syntax-error">오류 : youtube 동영상 ID는 첫번째 인자로 제공되어야 합니다!</span>')
                        }
                        break;
                    case '각주':
                    case 'footnote':
                    case 'footnotes':
                        let footnoteContent = '';
                        for(let j = 0; j < footnotes.length; j++) {
                            let footnote = footnotes[j];
                            footnoteContent += `<a href="#afn-${j+1}" id="fn-${j+1}" class="footnote"><sup class="footnote-sup">[${footnote.sup ? footnote.sup : j+1}]</sup></a> ${footnote.value}<br>`
                        }
                        footnotes = [];
                        appendResult(footnoteContent);
                        break;
                    case '목차':
                    case 'tableofcontents':
                    case 'toc':
                    case 'include':
                        appendResult(i.options ? {name: 'macro', macroName: i.macroName, options: i.options} : {name: 'macro', macroName: i.macroName});
                        break;
                    default:
                        appendResult('[Unsupported Macro]');
                        break;
                }
                break;
            case 'monoscape-font-start':
                wasPreMono = i.pre;
                appendResult((wasPreMono ? '<pre>' : '') + '<code>');
                break;
            case 'monoscape-font-end':
                appendResult('</code>' + (wasPreMono ? '</pre>' : ''));
                break;
            case 'strong-start':
                appendResult('<strong>');
                break;
            case 'italic-start':
                appendResult('<em>');
                break;
            case 'strike-start':
                appendResult('<del>');
                break;
            case 'underline-start':
                appendResult('<u>');
                break;
            case 'superscript-start':
                appendResult('<sup>');
                break;
            case 'subscript-start':
                appendResult('<sub>');
                break;
            case 'strong-end':
                appendResult('</strong>');
                break;
            case 'italic-end':
                appendResult('</em>');
                break;
            case 'strike-end':
                appendResult('</del>');
                break;
            case 'underline-end':
                appendResult('</u>');
                break;
            case 'superscript-end':
                appendResult('</sup>');
                break;
            case 'subscript-end':
                appendResult('</sub>');
                break;
            case 'unsafe-plain':
                appendResult(i.text);
                break;
            case 'font-color-start':
                appendResult(`<span style="color: ${i.color}>`);
                break;
            case 'font-size-start':
                appendResult(`<span class="wiki-size-${i.level}-level">`);
                break;
            case 'font-color-end':
            case 'font-size-end':
                appendResult('</span>');
                break;
            case 'external-image':
                appendResult(`<img src="${i.target}" ${i.styleOptions ? "style=\"" + ObjToCssString(i.styleOptions) + '"' : ''}/>`)
                break;
            case 'comment':
                // 주석은 뷰어에서 표시할 내용 없으므로 넘어감
                break; // 신경쓸 필요 X
            case 'heading-start':
                if(lastHeadingLevel < i.level)
                    hLevels[i.level]=0;
                lastHeadingLevel = i.level;
                hLevels[i.level]++;
                appendResult(`<h${i.level} id="heading-${++headingCount}"><a href="#wiki-toc">${hLevels[i.level]}. </a>`);
                isHeadingNow = true;
                headings.push({level: i.level, value: ''});
                break;
            case 'heading-end':
                isHeadingNow = false;
                appendResult(`</h${lastHeadingLevel}>`);
                break;
            case 'horizontal-line':
                appendResult('<hr>');
                break;
            case 'paragraph-start':
                appendResult('<p>');
                break;
            case 'paragraph-end':
                appendResult('</p>');
                break;
            case 'wiki-box-start':
                appendResult('<div ' + (i.style || '') + '>');
                break;
            case 'wiki-box-end':
                appendResult('</div>');
                break;
            case 'folding-start':
                appendResult('<details><summary>' + encodeHTMLComponent(i.summary) + '</summary>');
                break;
            case 'folding-end':
                appendResult('</details>');
                break;
        }
    }
    
    function finalLoop(callback) {
        // 최종실행 함수
        result = '';
        if(footnotes.length > 0) {
             // 각주 존재할 경우 맨 마지막에 출력하기
            _ht.processToken({name: 'macro', macroName: '각주'});
        }
        async.map(resultTemp, (item, mapcb) => {
            /* 
            [NOTE] Async map(array | Iterable | AsyncIterable | Object coll. iteratee, [callback])
            coll 배열의 각 값을 iteratee 함수를 통해 새 배열을 만든다.
            모든 처리가 끝나거나 오류가 발생하면 콜백 함수를 호출한다.
            콜백의 인수는 error과 결과값.
            
            + mapcb 함수로 콜백함수 호출
            */
            if(typeof item === "string")
                mapcb(null, item);
              // 그냥 HTML 태그이면 콜백 호출
            else if(item.name === "macro") {
                  // 매크로일때
                switch(item.macroName) {
                    case 'toc':
                    case 'tableofcontents':
                    case '목차':
                        let macroContent = '<div class="wiki-toc" id="wiki-toc"><div class="wiki-toc-heading">목차</div>';
                        let hLevels = {1:0,2:0,3:0,4:0,5:0,6:0}, lastLevel = -1;
                        for(let j = 0; j < headings.length; j++) {
                            let curHeading = headings[j];
                            if(lastLevel != -1 && curHeading.level > lastLevel)
                                hLevels[curHeading.level] = 0;
                            hLevels[curHeading.level]++;
                            macroContent += `<div class="wiki-toc-item wiki-toc-item-indent-${curHeading.level}"><a href="#heading-${j+1}">${hLevels[curHeading.level]}.</a> ${curHeading.value}</div>`;
                            lastLevel = curHeading.level;
                        }
                        // 문단이 존재할 때에만 목차 생성하기
                        macroContent += '</div></div>';
                        return mapcb(null, macroContent);
                    case 'include':
                        if(typeof item.options === 'undefined' || item.options.length === 0)
                            return mapcb(null, '<span class="wikitext-syntax-error">오류 : Include 매크로는 최소한 include할 문서명이 필요합니다.</span>');
                        else if(typeof item.options[0] !== 'string')
                            return mapcb(null, '<span class="wikitext-syntax-error">오류 : include할 문서명이 첫번째로 매크로 매개변수로 전달되어야 합니다.</span>');
                        let childPage = new Namumark(item.options[0], options.includeParserOptions);
                        childPage.setIncluded();
                        if(item.options.length > 1) {
                            let incArgs = {};
                            for(let k = 1; k < item.options.length; k++) {
                                let incArg = item.options[k];
                                if(typeof incArg === 'string') continue;
                                incArgs[incArg.name] = incArg.value;
                            }
                            childPage.setIncludeParameters(incArgs);
                        }
                        childPage.setRenderer(null, options);
                        childPage.parse((e, r) => {if(e) mapcb(null, '[include 파싱/렌더링중 오류 발생]'); else mapcb(null, r.html); console.log('appened!');})
                        break;
                }
            }
        }, (err, finalFragments) => {
            if (err)
                callback(err);
            let result = '';
            for(let i = 0; i < finalFragments.length; i++) {
                result += finalFragments[i];
            }
            callback(result);
              // 아래있는 콜백함수 적용
        });
    }
    this.getResult = (c) => {
        finalLoop((html) => {
              // 이 함수 말하는거다
            c(null, {html: html, categories: categories});
        })
    }
}

module.exports = HTMLRenderer;
