/** @param {string} ip */
function siyuanNormalizeBaseInput(ip) {
    // Normalize base URL
    let base = (ip || "").trim();
    if (!base) return "";
    if (!/^https?:\/\//i.test(base)) base = "http://" + base;
    // 去掉结尾的斜杆 https://github.com/siyuan-note/siyuan/issues/11478
    while (base.endsWith("/")) base = base.slice(0, -1);
    return base;
}

/** @param {string} ip */
function siyuanNormalizeBase(ip) {
    const base = siyuanNormalizeBaseInput(ip);
    return base || SIYUAN_DEFAULT_KERNEL_IP;
}

/**
 * @param {{ ip?: string, token: string, path: string, body?: object }} options
 * @returns {Promise<{ ok: true, data: object } | { ok: false, error: string }>}
 */
async function siyuanKernelFetch({ ip, token, path, body }) {
    const base = siyuanNormalizeBase(ip);
    try {
        const response = await fetch(base + path, {
            method: "POST",
            headers: {
                Authorization: "Token " + token,
                "Content-Type": "application/json; charset=UTF-8",
            },
            body: JSON.stringify(body ?? {}),
        });
        if (response.status === 401 || response.status === 403) {
            return { ok: false, error: "tip_token_invalid" };
        }
        if (response.status !== 200) {
            return { ok: false, error: "tip_siyuan_kernel_unavailable" };
        }
        let data;
        try {
            data = await response.json();
        } catch (e) {
            return { ok: false, error: "tip_siyuan_kernel_unavailable" };
        }
        return { ok: true, data };
    } catch (e) {
        return { ok: false, error: "tip_siyuan_kernel_unavailable" };
    }
}
