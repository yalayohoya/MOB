/*************************************************
* Postman-Compatible jquery.crypt.js (Standalone)
*************************************************/

export function crypt(options: any): string {

    var defaults = {
        b64Str  : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
        strKey  : "123",              // ? 브라우저와 동일해야 함
        method  : "md5",
        source  : "",
        chrsz   : 8,
        hexcase : 0
    };
    if (typeof(options.urlsafe) == 'undefined'){
        defaults.b64Str += '+/=';
        options.urlsafe = false;
    }else if (options.urlsafe){
        defaults.b64Str += '-_=';
    }else{
        defaults.b64Str += '+/=';
    }
   
    // options 병합
    var opts = Object.assign({}, defaults, options);

    if (!opts.source) {
        throw new Error("source 값이 없습니다.");
    }

    /* =========================
       method routing
    ========================= */
    if (opts.method === 'xteab64enc') {
        var tmp = xteaenc(opts);
        opts.source = tmp;
        return b64enc(opts);
    }

    if (opts.method === 'xteab64dec') {
        var tmp = b64dec(opts);
        opts.source = tmp;
        return xteadec(opts);
    }

    /* =========================
       Base64 Encode
    ========================= */
    function b64enc(params: any): string {
        var output = "";
        var chr1, chr2, chr3;
        var enc1, enc2, enc3, enc4;
        var i = 0;

        do {
            chr1 = params.source.charCodeAt(i++);
            chr2 = params.source.charCodeAt(i++);
            chr3 = params.source.charCodeAt(i++);

            enc1 = chr1 >> 2;
            enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
            enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
            enc4 = chr3 & 63;

            if (isNaN(chr2)) {
                enc3 = enc4 = 64;
            } else if (isNaN(chr3)) {
                enc4 = 64;
            }

            output += params.b64Str.charAt(enc1)
                    + params.b64Str.charAt(enc2)
                    + params.b64Str.charAt(enc3)
                    + params.b64Str.charAt(enc4);

        } while (i < params.source.length);

        return output;
    }

    /* =========================
       Base64 Decode
    ========================= */
    function b64dec(params: any): string {

        var output = "";
        var chr1, chr2, chr3;
        var enc1, enc2, enc3, enc4;
        var i = 0;

        var re = new RegExp('[^A-Za-z0-9\\+\\/\\=]', 'g');
        params.source = params.source.replace(re, "");

        do {
            enc1 = params.b64Str.indexOf(params.source.charAt(i++));
            enc2 = params.b64Str.indexOf(params.source.charAt(i++));
            enc3 = params.b64Str.indexOf(params.source.charAt(i++));
            enc4 = params.b64Str.indexOf(params.source.charAt(i++));

            chr1 = (enc1 << 2) | (enc2 >> 4);
            chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            chr3 = ((enc3 & 3) << 6) | enc4;

            output += String.fromCharCode(chr1);

            if (enc3 !== 64) output += String.fromCharCode(chr2);
            if (enc4 !== 64) output += String.fromCharCode(chr3);

        } while (i < params.source.length);

        return output;
    }

    /* =========================
       XTEA Encrypt
    ========================= */
    function xteaenc(params: any): string {

        var v = [0, 0], k = [], i, s = "";

        params.source = escape(params.source);

        for (i = 0; i < 4; i++) {
            k[i] = Str4ToLong(params.strKey.slice(i * 4, i * 4 + 4));
        }

        for (i = 0; i < params.source.length; i += 8) {
            v[0] = Str4ToLong(params.source.slice(i, i + 4));
            v[1] = Str4ToLong(params.source.slice(i + 4, i + 8));
            code(v, k);
            s += LongToStr4(v[0]) + LongToStr4(v[1]);
        }

        return escCtrlCh(s);
    }

    function xteadec(params: any): string {

        var v = [0, 0], k = [], i, s = "";

        for (i = 0; i < 4; i++) {
            k[i] = Str4ToLong(params.strKey.slice(i * 4, i * 4 + 4));
        }

        var ct = unescCtrlCh(params.source);

        for (i = 0; i < ct.length; i += 8) {
            v[0] = Str4ToLong(ct.slice(i, i + 4));
            v[1] = Str4ToLong(ct.slice(i + 4, i + 8));
            decode(v, k);
            s += LongToStr4(v[0]) + LongToStr4(v[1]);
        }

        return unescape(s.replace(/\0+$/, ""));
    }

    function code(v: any, k: any) {
        var y = v[0], z = v[1];
        var delta = 0x9E3779B9, sum = 0, limit = delta * 32;

        while (sum !== limit) {
            y += (z << 4 ^ z >>> 5) + z ^ sum + k[sum & 3];
            sum += delta;
            z += (y << 4 ^ y >>> 5) + y ^ sum + k[(sum >>> 11) & 3];
        }

        v[0] = y; v[1] = z;
    }

    function decode(v: any, k: any) {
        var y = v[0], z = v[1];
        var delta = 0x9E3779B9, sum = delta * 32;

        while (sum !== 0) {
            z -= (y << 4 ^ y >>> 5) + y ^ sum + k[(sum >>> 11) & 3];
            sum -= delta;
            y -= (z << 4 ^ z >>> 5) + z ^ sum + k[sum & 3];
        }

        v[0] = y; v[1] = z;
    }

    /* =========================
       Utilities
    ========================= */
    function Str4ToLong(s: any) {
        var v = 0;
        for (var i = 0; i < 4; i++) {
            v |= (s.charCodeAt(i) || 0) << (i * 8);
        }
        return v;
    }

    function LongToStr4(v: any) {
        return String.fromCharCode(
            v & 0xff,
            (v >> 8) & 0xff,
            (v >> 16) & 0xff,
            (v >> 24) & 0xff
        );
    }

    function escCtrlCh(str: any) {
        return str.replace(/[\0\t\n\v\f\r\xa0'"!]/g,
            (c: any) => '!' + c.charCodeAt(0) + '!');
    }

    function unescCtrlCh(str: any) {
        return str.replace(/!\d\d?\d?!/g,
            (c: any) => String.fromCharCode(c.slice(1, -1)));
    }

    throw new Error("지원하지 않는 암호화 방식입니다.");
}

/**
 * 🔒 입력된 평문 비밀번호를 SCOM API 전송용 XTEA+Base64로 인코딩하는 간편 헬퍼 함수
 */
export function encryptPassword(password: string): string {
    return crypt({
        method: 'xteab64enc',
        source: password,
        strKey: '123'
    });
}
