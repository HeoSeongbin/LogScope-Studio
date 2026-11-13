import { defineConfig, devices } from '@playwright/test';
const remote=process.env.E2E_BASE_URL;
export default defineConfig({
  testDir:'./e2e',fullyParallel:true,forbidOnly:!!process.env.CI,retries:0,workers:2,
  timeout:60000,expect:{timeout:15000},globalTimeout:10*60*1000,
  reporter:[['list'],['html',{open:'never'}],['json',{outputFile:'test-results/results.json'}]],
  use:{baseURL:remote??'http://127.0.0.1:4173/LogScope-Studio/',trace:'retain-on-failure',screenshot:'only-on-failure',acceptDownloads:true},
  projects:[
    {name:'chromium',use:{...devices['Desktop Chrome']}},
    {name:'firefox',use:{...devices['Desktop Firefox']}},
    {name:'webkit',use:{...devices['Desktop Safari']}},
    {name:'mobile-chromium',use:{...devices['Pixel 7'],viewport:{width:390,height:844}}},
  ],
  webServer:remote?undefined:{command:'node scripts/serve-build.mjs',url:'http://127.0.0.1:4173/LogScope-Studio/',reuseExistingServer:false,timeout:15000},
});
