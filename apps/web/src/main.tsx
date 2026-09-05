import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '@xuanshu/ui';
import { AppProvider } from '@xuanshu/ui';
import { loadCorpus } from './corpus';

async function bootstrap() {
  const root = document.getElementById('root');
  if (!root) throw new Error('缺少应用根节点 #root');
  try {
    const corpusDocs = await loadCorpus();
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <AppProvider corpusDocs={corpusDocs}>
          <App />
        </AppProvider>
      </React.StrictMode>,
    );
  } catch (error) {
    root.replaceChildren();
    const panel = document.createElement('main');
    panel.className = 'boot-error';
    const title = document.createElement('h1');
    title.textContent = '离线典籍载入失败';
    const detail = document.createElement('p');
    detail.textContent = error instanceof Error ? error.message : String(error);
    panel.append(title, detail);
    root.append(panel);
  }
}

void bootstrap();
