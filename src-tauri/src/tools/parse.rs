use reqwest::Url;

pub fn parse_url(url: &str) -> Result<String, String> {
    let parsed_url = Url::parse(url).map_err(|err| format!("Invalid URL: {err}"))?;
    if parsed_url.scheme().eq_ignore_ascii_case("socks5") {
        let (_, rest) = url
            .split_once("://")
            .ok_or_else(|| "Parsed URL has no scheme separator".to_string())?;
        Ok(format!("socks5h://{rest}"))
    } else {
        Ok(url.to_string())
    }
}
