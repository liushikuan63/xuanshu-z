/** 玄枢桌面壳主进程：安全默认（contextIsolation + 无 node 集成），加载本地构建或 dev server */
const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const DEV_URL = process.env.XUANSHU_DEV_URL || 'http://127.0.0.1:5190/';
const DIST = path.join(__dirname, '..', '..', 'web', 'dist');

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 720,
    title: '玄枢 · 八术综合占卜工作台',
    backgroundColor: '#f6f1e7',
    webPreferences: {
      contextIsolation: true,      // 渲染层与 Node 隔离（§11 安全基线）
      nodeIntegration: false,      // 渲染层禁止 Node
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });

  // 外链一律走系统浏览器，不在应用内打开（防导航劫持）
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('http://127.0.0.1:5190') && !url.startsWith('file://')) {
      e.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });

  if (fs.existsSync(path.join(DIST, 'index.html'))) {
    win.loadFile(path.join(DIST, 'index.html'));
  } else {
    win.loadURL(DEV_URL);
  }
  return win;
}

// 本地优先：无遥测、无云同步（D15 数据契约）
app.disableHardwareAcceleration = app.disableHardwareAcceleration; // 保持默认硬件加速
Menu.setApplicationMenu(null);

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
