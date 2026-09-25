import type { MetadataRoute } from "next"

/** Lets phones install the game to the home screen and launch it full-screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aurelia Core",
    short_name: "Aurelia",
    description: "AURELIA CORE 광산에서 코어를 채굴하는 클리커 게임",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#070B12",
    theme_color: "#070B12",
    icons: [{ src: "/clicker/icon/icon_core.png", sizes: "1024x1024", type: "image/png", purpose: "any" }],
  }
}
