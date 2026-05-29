// テーマ切り替え機能
export function initTheme() {
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  
  if (!themeToggle || !themeIcon) return;

  // ローカルストレージからテーマ設定を読み込み
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
  
  function setTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      themeIcon.textContent = 'light_mode';
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      themeIcon.textContent = 'dark_mode';
      localStorage.setItem('theme', 'light');
    }
  }
  
  // 初期テーマを適用
  setTheme(initialTheme);
  
  // テーマ切り替えボタンクリック時の処理
  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  });
}

// サイドバー機能
export function initSidebar() {
  const btn = document.getElementById('sidebarToggle');
  if (!btn) return;
  
  btn.addEventListener('click', () => {
    document.body.classList.toggle('sidebar-collapsed');
  });
  
  document.querySelectorAll('.sidebar-nav md-filled-tonal-button').forEach((link) => {
    link.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-nav md-filled-tonal-button').forEach((other) => other.classList.remove('active'));
      link.classList.add('active');
      if (window.matchMedia('(max-width: 900px)').matches) {
        document.body.classList.add('sidebar-collapsed');
      }
    });
  });
  
  if (!window.matchMedia('(max-width: 900px)').matches) {
    document.body.classList.remove('sidebar-collapsed');
  }

  document.addEventListener('click', (event) => {
    if (!window.matchMedia('(max-width: 900px)').matches) return;
    if (document.body.classList.contains('sidebar-collapsed')) return;

    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    const clickedInsideSidebar = sidebar.contains(event.target);
    const clickedMenuButton = btn.contains(event.target);
    if (!clickedInsideSidebar && !clickedMenuButton) {
      document.body.classList.add('sidebar-collapsed');
    }
  });
}
