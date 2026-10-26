"""Minimal HTTP wrapper: POST /clone {url, selector, viewports?} -> generated HTML + diff report.

Run: uvicorn server:app --port 8000
"""
import asyncio
import hashlib
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from playwright.async_api import async_playwright
from pydantic import BaseModel

from mirrorui.capture import DEFAULT_VIEWPORTS, CaptureError
from mirrorui.pipeline import clone

state = {}
slots = asyncio.Semaphore(2)


@asynccontextmanager
async def lifespan(_):
    async with async_playwright() as pw:
        state['browser'] = await pw.chromium.launch()
        yield
        await state['browser'].close()


app = FastAPI(title='MirrorUI', lifespan=lifespan)


class CloneRequest(BaseModel):
    url: str
    selector: str
    viewports: list[int] = list(DEFAULT_VIEWPORTS)
    verify: bool = True
    fonts: bool = False  # embed the page's own font files (only for fonts you're licensed to use)


@app.post('/clone')
async def clone_endpoint(req: CloneRequest):
    if not req.url.startswith(('http://', 'https://')):
        raise HTTPException(400, 'url must be http(s)')
    out_dir = 'out/' + hashlib.sha1(f'{req.url}|{req.selector}'.encode()).hexdigest()[:12]
    async with slots:
        try:
            result = await clone(state['browser'], req.url, req.selector, out_dir,
                                 sorted(req.viewports), check=req.verify, fonts=req.fonts)
        except CaptureError as e:
            raise HTTPException(422, str(e))
    return result
