module.exports = function seekEOL(text, offset = 0) {
    // 맨 마지막 문자가 \n이라면 텍스트 길이는 \n이 있는 위치임.
    return text.indexOf('\n', offset) == -1 ? text.length : text.indexOf('\n', offset);
}
