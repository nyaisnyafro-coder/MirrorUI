# MirrorUI

Bir web sayfasındaki tek bir bileşeni (DOM + hesaplanmış CSS) yakalayıp responsive **Tailwind v4 HTML** ve **Astro bileşenine** çevirir. LLM kullanmaz. İki şekilde çalışır:

- **Tarayıcı eklentisi (Chrome / Opera / Edge):** Sayfada bileşene tıklarsın, sonuç yeni sekmede açılır. Sunucu gerekmez.
- **Komut satırı (Python):** URL ve selector verirsin; sonucu orijinalle piksel piksel karşılaştırır.

İkisi aynı kodu kullanır (`extension/lib/`), aynı sayfa için aynı çıktıyı üretir.

## Tarayıcı eklentisi

**Kurulum (bir kez):**
- **Chrome / Edge:**
  1. `chrome://extensions` (Edge'de `edge://extensions`) sayfasını aç.
  2. Sağ üstten **Geliştirici modu**nu aç.
  3. **Paketlenmemiş öğe yükle** → `MirrorUI\extension` klasörünü seç.
- **Opera:**
  1. `opera://extensions` sayfasını aç.
  2. **Geliştirici modu**nu aç.
  3. **Paketlenmemiş uzantı yükle** → aynı klasörü seç.

**Kullanım:** Eklenti simgesine tıkla ya da `Alt+Shift+M` kısayolunu kullan. Sayfanın altında araç çubuğu açılır; her araç sonucunu sağdaki panelde gösterir. Aynı simge ya da kısayol çubuğu kapatır; `–` küçültür, `Esc` açık modu bitirir.

| Araç | Ne yapar |
|---|---|
| **Pick** | Fareyle bir bileşenin üstüne gel, tıkla (`↑` üst eleman, `↓` alt eleman). Bileşen 375 / 768 / 1280 px'te yakalanır ve sonuç büyük bir pencerede açılır. Üstte Astro / HTML / theme.css kodu, altta önizleme var. Önizleme **Clone**, **Original** ve **Side by side** arasında geçiş yapar; **Fit** ya da **100%** boyutunda gösterilir. İki bölümün arasındaki çizgi sürüklenerek kodun alanı ayarlanır. **Download ZIP** doğrudan bir Astro projesine kopyalanabilecek klasörü indirir (bileşen, tema, görseller, videolar, fontlar; bkz. *Kendi Astro sitende kullanmak*). **Save to project** sonucu projene doğrudan yazar; **Full view** sonucu ayrı bir sekmede açar. Genişlikler Pick panelinde değiştirilebilir. |
| **Inspect** | Üzerine gelince boyut, font, renk, padding/margin görünür (padding yeşil). Tıklayınca panelde box model ve stiller açılır. **Copy CSS**, **Tailwind** (elemanı Tailwind sınıflarına ve HTML'e çevirir) ve **Parent** düğmeleri var. Bir eleman seçiliyken `Alt` basılı tutup başka bir elemana gelince aradaki mesafe ölçülür. |
| **Colors** | Sayfada kullanılan bütün renkler, en çok kullanılandan başlayarak. Arka plan, metin, kenarlık ve vurgu renklerine göre süzülür. Bir renge tıklayınca kullanıldığı yerler işaretlenir. CSS değişkenleri, Tailwind `@theme` ya da JSON olarak dışa aktarılır. **Pick** ekrandaki herhangi bir rengi damlalıkla ekler. |
| **Fonts** | Metinlerin gerçekte kullandığı font aileleri; web fontu mu sistem fontu mu olduğu, kalınlıkları, boyutları ve canlı bir örnek. **Copy stack**, **Copy @font-face** ve **Highlight** (o fontla yazılmış metinleri işaretler) düğmeleri var. |
| **Assets** | Görseller, satır içi SVG'ler (sprite'lar içine kopyalanmış olarak), CSS arka plan görselleri, videolar ve ikonlar. Türüne göre süzülür, URL ya da SVG kopyalanır, tek tek ya da seçerek indirilir. |
| **Clone page** | Bütün sayfayı Pick gibi klonlar: tek bir Tailwind HTML belgesi ve bir Astro sayfa bileşeni. Sayfa bölümlerine ayrılır: `header`, `section`, `footer` gibi her bölüm kendi bileşeni olur (`Header.astro`, `Hero.astro`, `Footer.astro`…) ve sayfa bileşeni bunları import eder. Kod alanındaki dosya listesinden her birine bakılır. Canvas/WebGL çizimleri resim olarak gelir; videolar ve JavaScript animasyonları klonlanamaz. Önce sayfayı aşağı kaydır ki geç yüklenen içerik gelsin. |
| **Design MD** | Sayfanın ölçülmüş tasarım sistemi: renk token'ları, font aileleri, tip ölçeği (rol, boyut, satır yüksekliği, ağırlık), spacing ölçeği ve taban birimi, radius, gölge, breakpoint, container genişlikleri, geçiş süreleri ve buton stilleri. **Visual** ve **Markdown** görünümü var. `DESIGN.md` olarak ya da coding agent'lar için `SKILL.md` olarak (Claude Code'da `.claude/skills/<ad>/SKILL.md`) indirilir. |
| **Responsive** | Sekmeyi yerinde bir cihaz boyutunda gösterir: telefon, tablet, dizüstü, masaüstü ya da özel boyut. Telefon ve tabletlerde dokunmatik ekran ve 2× piksel yoğunluğu taklit edilir. **Capture all sizes** her boyutta bir ekran görüntüsü alır, istersen tüm sayfayı. **Own size** ya da aracı kapatmak sekmeyi kendi boyutuna döndürür. |
| **Capture** | Ekran görüntüsü: görünen alan, tüm sayfa, tek bir eleman ya da sürükleyerek seçilen bölge. Panelde önizleme, **Download** ve **Copy** (resim olarak panoya). Araç çubuğu görüntüye girmez. |
| **Swap font** | Google Fonts kataloğundaki yaklaşık 1950 aileden birini sayfada canlı dene. Kapsam olarak tüm metin, sadece başlıklar ya da sadece gövde metni seçilebilir. Fontlar ada göre aranır ve kategoriye göre süzülür; her kart kendi fontuyla önizlenir. Bilgisayarda yüklü bir fontu adıyla da kullanabilirsin. İkon fontları ve kod blokları (`monospace`) değişmez. **Undo** bir adım geri alır, **Revert** orijinal fontlara döner, kopyala düğmesi seçimi Google Fonts `<link>` + CSS + Tailwind `@theme` olarak verir. Pick ve Clone page değiştirilmiş fontu gerçek adıyla yakalar (ör. `font-lora`); klonu kullanacağın projeye o fontu Google Fonts'tan eklemen gerekir. |
| **Arrange** | Bir elemana tıklayınca silinir; sürükleyince başka bir elemanın önüne ya da arkasına taşınır (yeşil çizgi bırakılacağı yeri gösterir). `↑`/`↓` üst ya da alt elemana geçer, `Delete` üzerine gelinen elemanı siler, `Ctrl/⌘+Z` her adımı geri alır. Panelde yapılan değişiklikler listelenir, **Reset all** hepsini geri alır. Pick ve Clone page sayfayı düzenlediğin haliyle yakalar. |
| **Edit text** | Sayfadaki herhangi bir metne tıklayıp üzerine yaz. `Enter`/`Esc` bitirir, `Shift+Enter` yeni satır açar, `Ctrl/⌘+Z` son değişikliği geri alır. Panelde her değişiklik ayrı ayrı geri alınabilir, hepsi JSON olarak kopyalanır. Değişiklikler sayfa yenilenene kadar kalır; Pick ve Clone page düzenlenmiş metni yakalar, yani yeni metni klonlamadan önce deneyebilirsin. |

Pick ve Clone page yakalarken, Responsive bir boyut gösterirken ve Capture tüm sayfayı çekerken sayfanın üstünde "bir eklenti bu tarayıcıda hata ayıklıyor" uyarısı çıkar. Bu normal: genişlik taklidi DevTools protokolüyle yapılıyor. O uyarıdaki **İptal**, Responsive önizlemesini de bitirir. Son 8 klon saklanır.

Paneller ve sonuç penceresi başlıklarından tutulup sürüklenebilir. Bırakıldıkları yer sayfalar arasında hatırlanır; başlığa çift tıklamak varsayılan yerine döndürür. Responsive bir cihaz boyutu gösterirken panel tek satırlık bir şeride iner, böylece sayfa görünür kalır. **Devices** cihaz listesini yeniden açar.

Edit text, Swap font ve Arrange'ın değişiklikleri araç çubuğu kapatılınca da sayfada kalır; sayfa yenilenince orijinali geri gelir.

Dar ekranlarda (ya da Responsive bir telefon boyutu gösterirken) araç çubuğu yalnızca simgelerle görünür; araçların adları üzerine gelince çıkar. Panel alttan açılan bir sayfaya dönüşür.

Eklenti senin açık sekmeni okur: siteye yeni istek atmaz, giriş yaptığın sayfalarda da çalışır. `chrome://` sayfaları ve eklenti mağazası açılmaz; simgede kırmızı `×` görünür.

**Kod güncellendikten sonra:** `opera://extensions` (veya `chrome://extensions`) sayfasında MirrorUI kartındaki yenile düğmesine bas, sonra açık sekmeleri yenile.

## Komut satırı kurulumu (bir kez)

Komutları proje klasörünün içinden çalıştır (PowerShell):

```powershell
cd C:\Users\Batuhan\Desktop\MirrorUI
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m playwright install chromium
```

## Komut satırıyla klonlamak

```powershell
.venv\Scripts\python -m mirrorui "https://site.com/sayfa" ".hero" -o out\hero
```

- **Selector bulmak:** Tarayıcıda bileşene sağ tık → *İncele*. Bileşenin kök elemanının sınıfını kullan (`.hero`, `.pricing`), olmazsa Elements panelinde sağ tık → *Copy → Copy selector*. Birden fazla eşleşme varsa ilki alınır.
- **Seçenekler:**
  - `--viewports 375,768,1280`: yakalanan genişlikler. En küçüğü taban sınıflar olur, sonrakiler sırasıyla `md:` ve `lg:` öneklerini alır.
  - `--no-cache`: sayfayı yeniden çeker. Normalde aynı URL + selector önbellekten gelir.
  - `--no-verify`: karşılaştırma adımını atlar.
  - `--fonts`: sayfanın kendi font dosyalarını çıktıya gömer (bkz. Fontlar).

Komut, her viewport için orijinal ile klon arasında farklı olan piksellerin oranını yazar. %0–1 birebir demektir. %2–7 genelde font farkıdır; `--fonts` ile tekrar dene. Daha yüksek bir oranda `out/<ad>/original-*.png` ile `clone-*.png` dosyalarını yan yana açıp bak.

## Ne yakalanır

- Layout, boşluklar, tipografi, renkler, kenarlıklar, gölgeler: 3 genişlikte, `md:` / `lg:` önekleriyle.
- `::before` / `::after` → `before:` / `after:` sınıfları (içerik dahil).
- `:hover` durumları → `hover:` ve alt elemanlar için `group-hover:`. İç içe gruplarda isimli gruplar (`group/card`) kullanılır.
- `:focus`, `:focus-visible` ve `:active` durumları → `focus:`, `focus-visible:`, `active:` (elemanın kendisinde). Tarayıcının kendi odak halkası alınmaz.
- Durum değiştiren elemanların geçişleri (`transition-colors duration-200`).
- Transform'lar: `translate`, `rotate`, `scale` sınıflarına (`-translate-x-1/2`, `rotate-6`, `hover:scale-110`), eğiltme gibi diğerleri `[transform:…]` olarak.
- Gölgeler (`shadow-[…]`, iç gölgeler ve birden fazla gölge dahil) ve `outline`.
- Canvas ve WebGL çizimleri o anki görüntüleriyle `<img>` olur; genişliğe göre farklıysa `<picture>` ile her genişliğe kendi resmi.
- Altı çizili linklerin çizgi rengi, kalınlığı ve mesafesi.
- Sayfa içindeki SVG sprite'ları (`<use href="#icon">`) bileşenin içine kopyalanır.

## Çıktılar (`out/<ad>/`)

| Dosya | Ne işe yarar |
|---|---|
| `<Ad>.astro` | Astro bileşeni. 3+ tekrarlanan blok `.map` döngüsüdür, değişen alanlar prop'tur. Başlıklar, paragraflar, link ve buton yazıları, link adresleri ve görseller de prop'tur |
| `<ad>/<Bölüm>.astro` | Bütün sayfa (`body`) klonlanınca: her bölüm ayrı bileşen (`Header`, `Hero`, `Footer`…) |
| `theme.css` | Renk ve font token'ları (`@theme`) |
| `index.html` | Bağımsız önizleme. Tarayıcıda direkt açılır, Tailwind CDN'den yüklenir |
| `original-*.png`, `clone-*.png` | Karşılaştırma görüntüleri |

## Kendi Astro sitende kullanmak

**En kısa yol (eklenti):** Sonuç penceresinde **Save to project** → açılan sekmede projenin klasörünü seç. Şunları yazar:
- `src/components/<Ad>.astro` (sayfa klonunda bölümler `src/components/<ad>/` içinde),
- `src/styles/mirrorui/<ad>.css` (tema token'ları ve gömülü fontlar),
- `public/clone-assets/<ad>/` (görseller, videolar, fontlar, canvas resimleri; kod bunları `/clone-assets/<ad>/…` yolundan kullanır),
- ve `src/styles/global.css` içinde `@import "tailwindcss";` satırının altına `@import "./mirrorui/<ad>.css";` ekler.

Var olan bir dosyanın üzerine yazmadan ya da `global.css`'i değiştirmeden önce sorar. Seçtiğin klasör hatırlanır; **Change folder** başka projeye kaydeder. **Download ZIP** aynı dosyaları bir ZIP olarak verir (içinde nasıl kullanılacağını anlatan bir `README.md` ve tek başına açılan bir `index.html` de var).

Elle kurmak istersen (ya da komut satırı çıktısı için):

**1. Tailwind v4'ü kur** (projede yoksa):

```bash
npm i tailwindcss @tailwindcss/vite
```

`astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({ vite: { plugins: [tailwindcss()] } });
```

**2. Token'ları global CSS'ine ekle.**
- `src/styles/global.css` dosyasında `@import "tailwindcss";` satırı tek bir kez bulunsun.
- Altına `theme.css` içindeki `@theme { ... }` bloğunu yapıştır. Fontları gömdüysen üstündeki `@font-face` kurallarını da al.
- Birden fazla bileşen klonladıysan `@theme` bloklarını birleştir. Aynı isimli token'lar çakışırsa (iki farklı `accent` gibi) birini yeniden adlandır.
- Bu CSS dosyasını layout'unda bir kez import et.

**3. Bileşeni kopyala ve kullan:**

```
out/hero/Hero.astro  →  src/components/Hero.astro
```

```astro
---
import Hero from '../components/Hero.astro';
---
<Hero />
```

Prop vermezsen yakalanan içerikle render olur. Kendi içeriğini vermek için bileşenin tepesindeki `interface`'e bak:

```astro
<Wrap cards={[
  { title: 'Web siteleri', description: 'Hızlı ve erişilebilir siteler.' },
  { title: 'Kurumsal kimlik', description: 'Tutarlı tipografi ve renk.' },
]} />
```

**4. Kendine göre düzenle.**
- Linkler (`href`) orijinal siteyi gösterir, kendi adreslerinle değiştir.
- Başlıklar, paragraflar, link/buton yazıları, link adresleri ve görseller prop'tur (`title`, `heading`, `text`, `label`, `href`, `image`…); varsayılanları yakalanan içeriktir. `<Hero title="Yeni başlık" href="/kayit" />` gibi değiştirebilirsin. İçinde başka eleman olan metinler (`<h1>` içinde `<em>` gibi) bileşende sabit yazılıdır.
- Bileşen kendi dış boşluğunu (sayfa kenar boşluğu, arka plan rengi) taşımaz, bunu sayfandaki container verir.
  - Orijinaldeki değerleri görmek için `index.html` içindeki `#mirrorui-frame` sınıflarına bak.

## Fontlar

Eklentide **Embed original fonts** varsayılan olarak açıktır: klon sayfanın kendi fontlarıyla birebir görünür. Fontların çoğu ticari lisanslıdır; kendi projende kullanma hakkın yoksa kutuyu kapat (tercih hatırlanır). Kapalıyken `theme.css` içinde font adı ve yedek fontlar yazılıdır (`--font-helveticanow: helveticaNow, "Helvetica Neue", ...`); fontu yoksa tarayıcı yedeklere düşer. Komut satırında fontlar yalnızca `--fonts` ile gömülür.

İkon fontları (fontello, Font Awesome, Material Icons gibi; karakterleri Unicode'un özel kullanım alanında olan fontlar) her zaman gömülür: onlarsız ikonların yerinde boş kutular çıkar.

**Fontu kullanma hakkın varsa** (örneğin kendi siten), CLI'da `--fonts` ya da eklentide **Embed original fonts** kullan:
- Bileşenin kullandığı ailelerin `@font-face` kuralları `theme.css` dosyasına eklenir.
- Font dosyaları data URL olarak gömülür. Böylece klon her yerde aynı fontla görünür; orijinal sunucuya bağlı kalmaz, CORS sorunu çıkmaz.
- Örnek: ticari font kullanan bir formda fark %2–7'den %1–3'e indi.

## HTTP API (isteğe bağlı)

```bash
.venv/Scripts/python -m uvicorn server:app --port 8000
```

```bash
curl -X POST localhost:8000/clone -H "content-type: application/json" -d "{\"url\": \"https://site.com\", \"selector\": \".hero\"}"
```

İstek gövdesine `"fonts": true` eklersen fontlar gömülür. Yanıt; HTML, Astro kaynağı, tema ve karşılaştırma oranlarını içerir. Aynı alan adına istekler sırayla, toplamda en fazla 2 iş aynı anda çalışır.

## Proje yapısı

| Yol | İçerik |
|---|---|
| `extension/lib/extract.js` | Sayfada çalışır: DOM'u ve stilleri okur, hover farklarını çıkarır |
| `extension/lib/compile.js` | Yakalamayı Tailwind HTML + Astro'ya çevirir |
| `extension/lib/stage.js` | Orijinal ve klonu yan yana gösteren karşılaştırma görünümü (panel ve tam sayfa) |
| `extension/lib/package.js`, `zip.js` | Sonucu Astro proje dosyalarına (görseller `public/` altında) ve ZIP'e çevirir |
| `extension/toolbar/` | Sayfa içi araç çubuğu: kabuk (`ui.js`), her araç ayrı dosyada |
| `extension/` | Service worker (yakalama, indirme), tam sayfa sonuç görünümü, önizleme sandbox'ı |
| `mirrorui/` | CLI ve API: Playwright ile yakalar, aynı `extension/lib` dosyalarını çalıştırır, karşılaştırır |
| `tests/` | Testler (bkz. Testler) |
| `scripts/` | Mağaza paketi ve mağaza görselleri |
| `PRIVACY.md`, `STORE.md`, `store/` | Gizlilik politikası, mağaza başvuru metinleri, mağaza görselleri |

## Testler

```powershell
.venv\Scripts\python -m pip install -r requirements-dev.txt
.venv\Scripts\python -m pytest                 # regresyon sayfaları + eklenti (~2 dk, internetsiz)
.venv\Scripts\python -m pytest -m sites        # kaydedilmiş gerçek siteler
```

- `tests/cases/`: şimdiye kadar bulunan her hata için küçük bir sayfa. Her biri her genişlikte piksel piksel (%0,5'ten az fark) klonlanmalı ve düzeltmenin ürettiği sınıfları içermeli.
- `tests/test_extension.py`: eklentiyi Chromium'a yükleyip kullanıcı gibi kullanır: araç çubuğu, Pick, Clone page, ZIP, Save to project, Edit text.
- `tests/test_sites.py`: gerçek sitelerin kayıtları (`tests/sites/*.har.zip`) internetsiz, saat dondurulmuş olarak tekrar oynatılır; her çalıştırmada aynı sonuç. Sınırlar `tests/sites.json` içinde. Kayıtlar başkalarının içeriği olduğu için git'e girmez; bir kez kaydet: `.venv\Scripts\python tests
ecord_sites.py`.

## Chrome Web Store'a yükleme

```powershell
.venv\Scripts\python scripts\package_extension.py   # dist\mirrorui-<sürüm>.zip
.venv\Scripts\python scripts\store_images.py        # store\ altında ekran görüntüleri ve tanıtım görselleri
```

Paketleme öncesi manifest'in andığı her dosyanın varlığı, ikon boyutları ve uzaktan kod yüklenmediği kontrol edilir. Mağaza formundaki bütün metinler (açıklama, tek amaç, izin gerekçeleri, veri kullanımı, inceleyici notu) `STORE.md` içinde. `PRIVACY.md`'yi herkese açık bir adreste yayınlayıp (`SUPPORT_EMAIL` yerine iletişim adresini yazarak) adresini forma ekle. Her yeni sürümde `extension/manifest.json` içindeki `version` artırılmalı.

## Bilinen sınırlar

- Hover, focus ve active yalnızca en geniş viewport'ta okunur; focus/active yalnızca elemanın kendisindeki değişiklikler için.
- JavaScript animasyonları, yakalandıkları andaki halleriyle donmuş olarak gelir (ör. kayan bir slider o anki slaytında).
- Hover adayları başka alan adından yüklenen CSS'te tanımlıysa tahminle bulunur (link, buton, `cursor: pointer`).
- Yüksekliğini satırdaki komşusundan alan bir eleman tek başına alınırsa, o yükseklik `min-h` olarak korunur.
- Bazı genişliklerde `display: contents` olan bir eleman seçilirse, o genişlikte üst elemanının düzenine bağlıdır ve tek başına aynı görünmez. Bunun yerine bir üst elemanı seç.
- 3'ten az tekrarlanan bloklar döngüye çevrilmez.
- Canvas ve WebGL çizimleri durağan resim olur; kapalı shadow DOM içeriği klonlanamaz.
- Renk ve font token adları (`accent`, `ink`, `tone-95`…) her klonda aynı adlarla üretilir; aynı projeye kaydedilen ikinci bir klonun teması, öncekinin aynı isimli token'larını ezer.
- Bot korumalı sayfalar (Cloudflare challenge vb.) bilerek klonlanmaz, açık bir hata verilir.
- Önbellek, `extract.js` değişince kendiliğinden geçersiz olur.

Başkasının sitesinden aldığın tasarımı ve içeriği olduğu gibi yayınlama; ilham ve başlangıç noktası olarak kullan.
