use tauri::{Manager, Runtime, WebviewWindow, WebviewWindowBuilder};

pub fn build_window<'a, R: Runtime, M: Manager<R>>(
    window: WebviewWindowBuilder<'a, R, M>,
) -> Result<WebviewWindow<R>, tauri::Error> {
    window
        .center()
        .initialization_script(
            r#"
            const _close = window.close.bind(window);
            window.close = () => {
                if (window.__TAURI_INTERNALS__) {
                    window.__TAURI_INTERNALS__.invoke('plugin:window|close');
                } else {
                    _close();
                }
            };
            "#,
        )
        .build()
}
