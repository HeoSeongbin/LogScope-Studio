import { test as base, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

// Every browser gets an isolated context. Only public synthetic samples are used.
const test=base.extend<{guard:void}>({guard:[async({page,baseURL},use)=>{
  const errors:string[]=[],external:string[]=[],writes:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{const url=new URL(request.url());if(/^https?:$/.test(url.protocol)&&url.origin!==new URL(baseURL!).origin)external.push(url.origin);if(!['GET','HEAD'].includes(request.method()))writes.push(request.method());});
  await use();expect(errors,'uncaught browser errors').toEqual([]);expect(external,'unexpected remote requests').toEqual([]);expect(writes,'logs must not be transmitted').toEqual([]);
},{auto:true}]});
async function upload(page:Page,names:string[],count:number){
  await page.getByLabel('로그 파일 업로드',{exact:true}).setInputFiles(names.map(name=>resolve('public/samples',name)));
  await expect(page.getByRole('button',{name:`모든 파일 ${count}`,exact:true})).toBeVisible();
}
async function downloadJSON(page:Page,region='분석 결과 내보내기'){
  const panel=page.getByRole('region',{name:region,exact:true});
  const pending=page.waitForEvent('download');await panel.getByRole('button',{name:'선택 범위 다운로드',exact:true}).click();
  const download=await pending;expect(await download.failure()).toBeNull();return JSON.parse(await readFile((await download.path())!,'utf8'));
}
test.beforeEach(async({page})=>{await page.goto('./');await expect(page.getByRole('heading',{name:/로그 탐색기Phase/})).toBeVisible();});

test('production prefix loads sample and parse/search Workers with exact source provenance',async({page})=>{
  const workers:string[]=[];page.on('worker',worker=>workers.push(worker.url()));
  await upload(page,['spring-exception.log'],3);
  await page.getByRole('button',{name:'Database request failed',exact:true}).first().click();
  await expect(page.getByLabel('선택 이벤트 원본과 진단')).toContainText('줄 1–9');
  await page.getByLabel('검색 방식',{exact:true}).selectOption('regex');await page.getByLabel('검색어',{exact:true}).fill('Database|Health');await page.getByRole('button',{name:'검색 적용',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'3개 결과 / 3개 이벤트'})).toBeVisible();
  expect(workers.some(url=>url.includes('parse.worker-'))).toBe(true);expect(workers.some(url=>url.includes('search.worker-'))).toBe(true);
  await page.getByText('분석 결과 내보내기',{exact:true}).click();const data=await downloadJSON(page);
  const lines=(await readFile('public/samples/spring-exception.log','utf8')).split('\n');
  expect(data.rows).toHaveLength(3);expect(data.rows[0].rawText).toBe(lines.slice(0,9).join('\n'));expect(data.rows[0].exception.type).toBe('java.sql.SQLException');
  expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0});
});

test('mixed structured/IIS uploads retain recoverable failures and file reparse/remove lifecycle',async({page})=>{
  await upload(page,['structured.jsonl','iis-access.log'],9);
  await page.getByRole('button',{name:/^structured.jsonl .*5개 이벤트/}).click();
  await expect(page.getByLabel('파일 분석 설정')).toContainText('파싱 실패 1개');
  await page.getByRole('combobox',{name:'structured.jsonl 로그 형식',exact:true}).selectOption('generic');
  await expect(page.getByLabel('파일 분석 설정')).toContainText('Generic Text');
  await page.getByRole('button',{name:'structured.jsonl 제거',exact:true}).click();await expect(page.getByRole('button',{name:'모든 파일 4',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'세션 초기화',exact:true}).click();await expect(page.getByRole('button',{name:'모든 파일 0',exact:true})).toBeVisible();
});

test('cross-file trace respects explicit timezone, null time and exact selected export scope',async({page})=>{
  await upload(page,['distributed-api.log','distributed-db.log'],7);
  await page.getByRole('button',{name:/^distributed-db.log .*3개 이벤트/}).click();
  await page.getByLabel('파일 시간대',{exact:true}).fill('UTC');await page.getByRole('button',{name:'파일 설정 적용 및 재분석',exact:true}).click();
  await expect(page.getByRole('button',{name:'파일 설정 적용 및 재분석',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'모든 파일 7',exact:true}).click();await page.getByRole('button',{name:'요청 추적 04',exact:true}).click();
  await expect(page.getByRole('heading',{name:'시간순 관측 이벤트 · 5개',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'시각 미확인 이벤트 (시간축 제외) · 1개',exact:true})).toBeVisible();
  await page.getByText('선택 추적 내보내기',{exact:true}).click();const data=await downloadJSON(page,'선택 추적 내보내기');
  expect(data.metadata.kind).toBe('trace');expect(data.rows).toHaveLength(6);expect(data.rows.filter((row:{timestamp:number|null})=>row.timestamp===null)).toHaveLength(1);expect(data.metadata.summary.observedWindowMs).toBe(4030);
});

test('dashboard bucket drill-down and statistics export use actual observed counts',async({page})=>{
  await upload(page,['statistics-demo.jsonl'],12);await page.getByRole('button',{name:'Dashboard 00',exact:true}).click();
  await expect(page.getByText('41.7%',{exact:true})).toBeVisible();await page.getByRole('button',{name:'집중 구간 선택 2026-11-06T05:31:00.000Z',exact:true}).click();await expect(page.getByRole('heading',{name:'선택 구간 이벤트 · 5개',exact:true})).toBeVisible();
  await page.getByLabel('시간 버킷',{exact:true}).selectOption('5m');await page.getByText('통계 내보내기',{exact:true}).click();await page.getByLabel('통계 내보내기 대상',{exact:true}).selectOption('timeline');
  const data=await downloadJSON(page,'통계 내보내기');expect(data.metadata.context.bucketSize).toBe('5m');expect(data.metadata.summary).toMatchObject({timed:10,untimed:2,counts:{total:12,errors:5}});
});

test('CSV and inert HTML downloads keep Unicode, CRLF and malicious text local',async({page,context})=>{
  const raw='=1+1\r\n<img src="https://invalid.example/x" onerror="alert(1)"> 한글 😀';
  await page.getByLabel('로그 파일 업로드',{exact:true}).setInputFiles({name:'synthetic.log',mimeType:'text/plain',buffer:Buffer.from(raw)});await expect(page.getByRole('button',{name:'모든 파일 2',exact:true})).toBeVisible();
  await page.getByText('분석 결과 내보내기',{exact:true}).click();await page.getByLabel('분석 결과 내보내기 형식',{exact:true}).selectOption('csv');
  let pending=page.waitForEvent('download');await page.getByRole('region',{name:'분석 결과 내보내기',exact:true}).getByRole('button',{name:'선택 범위 다운로드',exact:true}).click();let download=await pending;const csv=await readFile((await download.path())!);expect([...csv.subarray(0,3)]).toEqual([239,187,191]);expect(csv.toString('utf8')).toContain('"\'=1+1"');expect(csv.toString('utf8')).toContain('한글 😀');
  await page.getByLabel('분석 결과 내보내기 형식',{exact:true}).selectOption('html');pending=page.waitForEvent('download');await page.getByRole('region',{name:'분석 결과 내보내기',exact:true}).getByRole('button',{name:'선택 범위 다운로드',exact:true}).click();download=await pending;const html=await readFile((await download.path())!,'utf8');
  expect(html).toContain('&lt;img');expect(html).not.toContain('<img');
  const report=await context.newPage();await report.setContent(html);await expect(report.getByRole('heading',{name:'현재 필터 결과',exact:true})).toBeVisible();expect(await report.locator('script,img').count()).toBe(0);await report.close();
});

test('invalid filters and damaged encoding report reasons without replacing prior good events',async({page})=>{
  await upload(page,['spring-normal.log'],5);await page.getByLabel('로그 파일 업로드',{exact:true}).setInputFiles({name:'bad.txt',mimeType:'text/plain',buffer:Buffer.from([0xff,0xfe,0x00])});
  await expect(page.getByText(/UTF-8 또는 BOM이 있는 UTF-16 텍스트/)).toBeVisible();await expect(page.getByRole('button',{name:'모든 파일 5',exact:true})).toBeVisible();
  await page.getByLabel('시작 시각',{exact:true}).fill('not-a-date');await page.getByRole('button',{name:'검색 적용',exact:true}).click();await page.getByText('분석 결과 내보내기',{exact:true}).click();
  await expect(page.getByRole('region',{name:'분석 결과 내보내기',exact:true}).getByRole('button',{name:'선택 범위 다운로드',exact:true})).toBeDisabled();await page.getByRole('button',{name:'검색 초기화',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'5개 결과 / 5개 이벤트'})).toBeVisible();
});

test('themes, responsive overflow and keyboard navigation stay accessible under automated rules',async({page})=>{
  await upload(page,['spring-exception.log'],3);
  for(const theme of ['dark','light']){
    if(theme==='light')await page.getByRole('button',{name:'밝은 테마',exact:true}).click();
    const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(results.violations,JSON.stringify(results.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),null,2)).toEqual([]);
  }
  const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
  const slider=page.getByRole('slider',{name:'상세 패널 너비',exact:true});if(await slider.isVisible()){await slider.press('End');await expect(slider).toHaveValue('560');}
  await page.getByRole('button',{name:'Database request failed',exact:true}).first().press('Enter');await expect(page.getByLabel('선택 이벤트 원본과 진단')).toContainText('줄 1–9');
});
