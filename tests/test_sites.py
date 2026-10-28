"""Real sites replayed from their recordings (tests/record_sites.py), with the page clock frozen: no network,
same result every run. The limits in sites.json are a little above today's results, so a change that makes
clones of real pages worse fails here.

    pytest -m sites

tests/sites.json is your own list and stays on your machine (git-ignored); tests/sites.example.json shows the
format. Without it these tests are skipped.
"""
import json
from pathlib import Path

import pytest

from conftest import OUTPUT, assert_matches, clone_url, run
from mirrorui.capture import Replay

HERE = Path(__file__).resolve().parent
SITES = json.loads((HERE / 'sites.json').read_text(encoding='utf-8')) if (HERE / 'sites.json').exists() else {}


@pytest.mark.sites
@pytest.mark.parametrize('name', SITES or [pytest.param(None, marks=pytest.mark.skip(
    reason='no tests/sites.json: copy tests/sites.example.json and record the sites'))])
def test_site(name):
    site = SITES[name]
    har = HERE / 'sites' / f'{name}.har.zip'
    if not har.exists():
        pytest.skip(f'not recorded: python tests/record_sites.py {name}')
    # with the page's own fonts embedded, as with "Embed fonts" on: a fallback font would dominate the diff
    result = run(clone_url(site['url'], site['selector'], OUTPUT / 'sites' / name, replay=Replay(har), fonts=True))
    for width, r in sorted(result['report'].items()):
        print(f'{name} {width}px: {r["diff"]:.1%} differ, original {r["size_a"]}, clone {r["size_b"]}')
    assert_matches(result, {int(k): v for k, v in site['max_diff'].items()}, site.get('max_height_diff', 2))
