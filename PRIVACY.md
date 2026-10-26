# MirrorUI privacy policy

_Last updated: 26 October 2026_

MirrorUI is a browser extension that turns parts of the web page you are looking at into Tailwind CSS and Astro
code, with tools to inspect that page (elements, colours, fonts, assets, responsive sizes, screenshots).

## What MirrorUI does not do

- It has no servers and no accounts. Nothing you do with MirrorUI is sent to the developer or to anyone else.
- No analytics, tracking, advertising or telemetry.
- It does not sell, share or transfer any data, and does not use data for anything other than the feature you
  are using at that moment.

## What it reads, and only when you use it

MirrorUI does nothing on a page until you open its toolbar there (toolbar button or Alt+Shift+M). Then, for the
tool you choose, it reads the page's content and styles in your browser: the elements and computed styles of
what you pick or clone, the page's colours, fonts and images, or a screenshot.

To work across viewport sizes and to capture hover and focus styles, MirrorUI uses the browser's debugging
interface (the `debugger` permission) on that one tab, only while a capture, a responsive preview or a
full-page screenshot runs. The browser shows a notice bar while this happens.

## Network requests

MirrorUI makes requests only as part of a feature you started:

- **Files of the page you clone or inspect** (stylesheets, fonts, images, videos), fetched from the addresses
  the page itself uses, when you clone with "Embed fonts", download assets, download a ZIP or save to a project.
  Your cookies are not sent with these requests.
- **Google Fonts**, when you use Swap font: the font catalogue (`fonts.google.com`) and the stylesheets and font
  files of the fonts you try (`fonts.googleapis.com`, `fonts.gstatic.com`). Google's privacy policy applies to
  those requests.

## What is stored, and where

Everything stays in your browser's local extension storage, on your device:

- your last 8 clones (the captured page structure, styles and screenshots), so the result can be reopened;
- your settings (capture widths, "Embed fonts") and where you moved the panels;
- for "Save to project", access to the project folder you chose, so the next save can go to the same place.
  MirrorUI only writes into that folder when you click Save, and asks before replacing a file.

Removing the extension deletes all of it. Files you download or save to a project are yours and are not
tracked.

## Contact

Questions about this policy: SUPPORT_EMAIL (the contact address of the MirrorUI listing in the Chrome Web Store)

---

# MirrorUI gizlilik politikası (Türkçe özet)

MirrorUI'ın sunucusu, hesabı, analitiği ya da takibi yoktur; hiçbir veri geliştiriciye veya üçüncü kişilere
gönderilmez, satılmaz, paylaşılmaz. Eklenti yalnızca araç çubuğunu açtığın sekmede ve seçtiğin araç için sayfanın
içeriğini ve stillerini tarayıcında okur. Farklı genişliklerde yakalama ve hover/focus stilleri için yalnızca o
sekmede, işlem sürerken tarayıcının hata ayıklama arabirimini (`debugger`) kullanır.

Ağ istekleri yalnızca senin başlattığın bir özellik için yapılır: klonladığın sayfanın kendi dosyaları (stil,
font, görsel, video; çerezlerin gönderilmeden) ve Swap font kullanırken Google Fonts. Son 8 klon, ayarların ve
"Projeye kaydet" için seçtiğin klasöre erişim yalnızca cihazındaki eklenti deposunda tutulur; eklentiyi kaldırınca
silinir.
