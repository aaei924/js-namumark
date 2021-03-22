const extend = require('extend');

function parseOptionBracket(optionContent) {
    let colspan = 0, rowspan = 0, colOptions = {}, tableOptions = {}, rowOptions = {}, matched = false;
    if (/^-[0-9]+$/.test(optionContent)) {
        // 가로 합치기
        colspan += parseInt(/^-([0-9]+)$/.exec(optionContent)[1]);
        matched = true;
    } else if (/^\|[0-9]+$/.test(optionContent) || /^\^\|([0-9]+)$/.test(optionContent) || /^v\|([0-9]+)$/.test(optionContent)) {
        // 세로 합치기
        rowspan += parseInt(/^\|([0-9]+)$/.exec(optionContent)[1] || /^\^\|([0-9]+)$/.exec(optionContent)[1] || /^v\|([0-9]+)$/.exe(optionContent)[1]);
        matched = true;
        if (/^\^\|([0-9]+)$/.test(optionContent))
            colOptions["vertical-align"] = "top";
        else if (/^v\|([0-9]+)$/.test(optionContent))
            colOptions["vertical-align"] = "bottom";
        else if (/^\|([0-9]+)$/.test(optionContent))
            colOptions["vertical-align"] = "middle";
    } else if (optionContent.startsWith("table ")) {
        // 테이블 설정
        let tableOptionContent = optionContent.substring(6);
        let tableOptionPatterns = {
            "align": /^align=(left|center|right)$/,
            "background-color": /^bgcolor=(#[a-zA-Z0-9]{3,6}|[a-zA-Z]+)$/,
            "border-color": /^bordercolor=(#[a-zA-Z0-9]{3,6}|[a-zA-Z]+)$/,
            "width": /^width=([0-9]+(?:in|pt|pc|mm|cm|px))$/
        };
        for (let optionName in tableOptionPatterns) {
            if (tableOptionPatterns[optionName].test(tableOptionContent)) {
                tableOptions[optionName] = tableOptionPatterns[optionName].exec(tableOptionContent)[1];
                matched = true;
            }
        }
    } else {
        // 셀 옵션 패턴 (매개변수 X)
        let textAlignCellOptions = {
            "left": /^\($/,
            "middle": /^:$/,
            "right": /^\)$/
        };
        // 셀 옵션 패턴 (매개변수 O)
        let paramlessCellOptions = {
            "background-color": /^bgcolor=(#[0-9a-zA-Z]{3,6}|[a-zA-Z0-9]+)$/,
            "row-background-color": /^rowbgcolor=(#[0-9a-zA-Z]{3,6}|[a-zA-Z0-9]+)$/,
            "width": /^width=([0-9]+(?:in|pt|pc|mm|cm|px|%))$/,
            "height": /^height=([0-9]+(?:in|pt|pc|mm|cm|px|%))$/
        }
        for (let i in textAlignCellOptions) {
            if (textAlignCellOptions[i].test(optionContent)) {
                colOptions["text-align"] = optionContent;
                matched = true;
            }
            else
                for (let optionName in paramlessCellOptions) {
                    if(!paramlessCellOptions[optionName].test(optionContent))
                        continue;
                    if(optionName.startsWith("row-"))
                        rowOptions[optionName.substring(4)] = paramlessCellOptions[optionName].exec(optionContent)[1];
                    else
                        colOptions[optionName] = paramlessCellOptions[optionName].exec(optionContent)[1];
                    matched = true;
                }
        }
    }
    // colspan_add = 0, rowspan_add = 0, colOptions = {}, tableOptions = {};
    return {colspan_add: colspan, rowspan_add: rowspan, colOptions_set: colOptions, rowOptions_set: rowOptions, tableOptions_set: tableOptions, matched: matched};
};
module.exports = (wikitext, pos, setpos) => {
    // 시발 표 존나 복잡하네
    // 버그 : || 2행이 {{{ || }}} 되어야 하는데 || 3행으로 됨 ㅋ ||
    let caption = null;
    // ||로 시작하지 않으면 캡션부터 처리
    if (!wikitext.substring(pos).startsWith('||')) {
        caption = wikitext.substring(pos + 1, wikitext.indexOf('|', pos + 2));
        pos = wikitext.indexOf('|', pos + 1) + 1;
        console.log(caption);
    } else {
        pos += 2;
    }
    // || 기준으로 끊어서 컬럼 분할
    let cols = wikitext.substring(pos).split('||'),
        rowno = 0,
        hasTableContent = false,
        colspan = 0,
        rowspan = 0;
    // <|2> 같은 표 옵션 정규식
    let optionPattern = /<(.+?)>/;
    console.log(cols);
    let table = {
        0: []
    };
    let tableOptions = {};
    // parse cols, result= {wikitext, options, rowOptions} => table
    let i;
    // js의 length = PHP의 count()
    // 열이 하나일때
    if(cols.length < 2)
        return null;
    for (i = 0; i < cols.length; i++) {
        // PHP의 foreach($col as $cols)와 비슷
        let col = cols[i],
            curColOptions = {},
            rowOption = {};
        // 개행하는 지점에서 끊기
        if (col.startsWith('\n') && col.length > 1) {
            // table end
            break;
        }
        // 개행하는 지점에서 다음 행으로 넘어가기
        if (col == '\n') {
            // new row
            // 행번호 1 추가
            table[++rowno] = [];
            continue;
        }
        if (col.length == 0) {
            // 이런 형식의 열 합치기 : |||||| 합쳐진 열 ||
            colspan++;
            continue;
        }
        // || 좌측정렬||우측정렬 || 가운데정렬 ||
        if (col.startsWith(' ') && !col.endsWith(' '))
            curColOptions["text-align"] = "left"
        else if (!col.startsWith(' ') && col.endsWith(' '))
            curColOptions["text-align"] = "right"
        else if (col.startsWith(' ') && col.endsWith(' '))
            curColOptions["text-align"] = "middle"

        // preg_match() 함수와 유사 (옵션 찾기)
        while (optionPattern.test(col)) {
            // 옵션이 존재함.
            let match = optionPattern.exec(col);
            if (match.index != 0)
                break; // 옵션이 아님 ||<|2> 이건 옵션이지만 || <|2> 이렇게 중간에 뭐라도 있으면 옵션으로 간주 안함. (더시드위키 테스트 결과)
            let optionContent = match[1];
            let {colOptions_set, tableOptions_set, colspan_add, rowspan_add, rowOptions_set, matched} = parseOptionBracket(optionContent);
            curColOptions = extend(true, curColOptions, colOptions_set);
            tableOptions = extend(true, tableOptions, tableOptions_set);
            rowOptions_set = extend(true, rowOption, rowOptions_set);
            
            // colspan = colspan + colspan_add
            colspan += colspan_add;
            rowspan += rowspan_add;

            if (tableOptions["border-color"]) {
                // 인자에 맞게 설정 후 인자 삭제
                tableOptions["border"] = `2px solid ${tableOptions["border-color"]}`;
                delete tableOptions["border-color"];
            }
            //if (matched) {
                // 컬럼 변수에 옵션부분 제외하고 할당
                col = col.substring(match[0].length);
            //}
        }
        let colObj = {options: curColOptions, colspan: colspan, rowspan: rowspan, rowOption: rowOption, wikitext: col};
        colspan = 0; rowspan = 0;
        table[rowno].push(colObj);
        // row 배열속에 col 들어있는 구조 생성
        hasTableContent = true;
        // 내용있음 표시
    }
    // gen row options
    // table 배열에는 row 개수만큼 배열이 들어 있음. 이 배열 안에는 row 설정이 들어가 있음.
    let rowOptions = [];
    for (let j = 0; j < table.length; j++) {
        let rowOption = {};
        for(let k = 0; k < table[j].length; k++) {
            rowOption = extend(true, rowOption, table[j].rowOption);
        }
        rowOption.push(rowOption);
    }
    // return as tokens
    let result = [{name:"table-start", options: tableOptions}];
    // table 배열 속 키 개수 = row 개수
    let rowCount = Object.keys(table).length;
    for (let j = 0; j < rowCount; j++) {
        result.push({name: "table-row-start", options: rowOptions[j]});
        for(let k = 0; k < table[j].length; k++) {
            result.push({name: "table-col-start", options: table[j][k].options, colspan: table[j][k].colspan, rowspan: table[j][k].rowspan});
            result.push({name: "wikitext", text: table[j][k].wikitext, treatAsLine: true});
            result.push({name: "table-col-end"});
        }
        result.push({name:"table-row-end"});
    }
    result.push({name:"table-end"});
    if(hasTableContent) {
        // 컬럼 사이에 || 끼워둠
        setpos(pos + cols.slice(0, i).join('||').length + 1)
        return result;
        // result배열 구조:
// table-start, 테이블옵션
// ㄴ table-row-start, row옵션
//    ㄴ table-col-start, col옵션, colspan, rowspan - wikitext, 본문내용, line취급여부 - table-col-end
//    ... col 개수만큼 반복
// ㄴ table-row-end
// ... row 개수만큼 반복
// table-end
    } else {
        return null;
    }
};
