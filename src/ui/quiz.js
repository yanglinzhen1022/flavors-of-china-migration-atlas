/**
 * 「风味盲猜 · 风物小试」Interactive Culinary Geography Quiz
 */
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const QUIZ_POOL_IDS = [
  'chengdu', 'xian', 'hangzhou', 'guangzhou', 'chaozhou', 'liuzhou',
  'guiyang', 'harbin', 'yangzhou', 'kaifeng', 'fuzhou', 'kunming',
  'shunde', 'lanzhou', 'shaoxing', 'nanjing', 'chongqing', 'haikou',
  'huangshan', 'hongkong', 'qingdao', 'ningbo', 'dali', 'huhehaote',
  'yinchuan', 'leshan', 'shenyang', 'macau', 'guilin', 'jingdezhen',
  'xinyang', 'tianshui', 'turpan', 'wuyishan', 'shantou', 'hefei',
];

export class FlavorQuiz {
  constructor(containerEl, projector, renderer, { onFinish, onClose } = {}) {
    this.el = containerEl;
    this.proj = projector;
    this.renderer = renderer;
    this.onFinish = onFinish || (() => {});
    this.onClose = onClose || (() => {});

    this.active = false;
    this.questions = [];
    this.round = 0;
    this.score = 0;
    this.guessCoord = null;
    this.submitted = false;
    this.revealedClues = 1;
  }

  start(cities) {
    const map = new Map(cities.map((c) => [c.id, c]));
    const pool = QUIZ_POOL_IDS.map((id) => map.get(id)).filter(Boolean);
    // Shuffle deterministically-enough with Math.random
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    this.questions = pool.slice(0, 8);
    this.round = 0;
    this.score = 0;
    this.guessCoord = null;
    this.submitted = false;
    this.revealedClues = 1;
    this.active = true;

    this.renderer.setQuizMode(true);
    this.renderer.renderQuizOverlay({});
    this.el.classList.remove('is-hidden');
    this.render();
  }

  handleMapClick(coord) {
    if (!this.active || this.submitted) return;
    this.guessCoord = coord;
    this.renderer.renderQuizOverlay({ guessCoord: coord });
    this.render();
  }

  submitGuess() {
    if (!this.active || !this.guessCoord || this.submitted) return;
    const target = this.questions[this.round];
    const km = this.proj.greatCircleKm(this.guessCoord, target.coord);
    const pts = Math.max(0, Math.round(100 * Math.exp(-km / 420)));
    this.score += pts;
    this.submitted = true;
    this.renderer.renderQuizOverlay({
      guessCoord: this.guessCoord,
      targetCoord: target.coord,
      targetName: `${target.name}（${target.province}）`,
    });
    this.render(km, pts);
  }

  nextRound() {
    if (this.round + 1 >= this.questions.length) {
      this.renderSummary();
      return;
    }
    this.round += 1;
    this.guessCoord = null;
    this.submitted = false;
    this.revealedClues = 1;
    this.renderer.renderQuizOverlay({});
    this.render();
  }

  close() {
    this.active = false;
    this.renderer.setQuizMode(false);
    this.renderer.renderQuizOverlay({});
    this.el.classList.add('is-hidden');
    this.el.innerHTML = '';
  }

  _buildClues(city) {
    const firstTl = city.timeline[0];
    const spec = city.specialties[0];
    return [
      `线索 1（水土风味）：${city.geoReason}`,
      `线索 2（历史典故）：${firstTl.eraLabel}时期，${firstTl.title}——${firstTl.detail}`,
      `线索 3（代表风物）：当地以「${spec.name}」与「${city.dishes.slice(0, 2).join('、')}」闻名。`,
    ];
  }

  render(lastKm = null, lastPts = null) {
    const target = this.questions[this.round];
    const clues = this._buildClues(target);
    const cluesHtml = clues
      .slice(0, this.submitted ? 3 : this.revealedClues)
      .map((c) => `<div class="quiz-clue">${esc(c)}</div>`)
      .join('');

    const canRevealMore = !this.submitted && this.revealedClues < 3;

    this.el.innerHTML = `
      <div class="quiz-top">
        <span class="mini-tag" style="background:#b83b2b;color:#fff">风味盲猜</span>
        <span class="quiz-step">第 ${this.round + 1} / ${this.questions.length} 题</span>
        <span class="quiz-score">总分 ${this.score}</span>
        <button type="button" class="icon-close" id="act-quiz-close" aria-label="退出挑战">✕</button>
      </div>
      <div class="quiz-prompt">请在空白舆图上扎针标定这座<strong>风味名城</strong>（风格：${esc(target.flavorTags.join(' · '))}）</div>
      <div class="quiz-clues">${cluesHtml}</div>
      <div class="quiz-actions">
        ${canRevealMore ? '<button type="button" class="rp-btn" id="act-quiz-hint">再看一条线索</button>' : ''}
        ${!this.submitted ? `<button type="button" class="rp-btn is-accent" id="act-quiz-submit" ${this.guessCoord ? '' : 'disabled'}>${this.guessCoord ? '确认落针 ↵' : '请先在地图上点选位置'}</button>` : ''}
      </div>
      ${
        this.submitted
          ? `<div class="quiz-verdict">
              <div>答案：<strong>${esc(target.name)}</strong>（${esc(target.province)}） · 偏差 <strong>${Math.round(lastKm)} km</strong> · 本题 <strong>+${lastPts} 分</strong></div>
              <button type="button" class="rp-btn is-accent" id="act-quiz-next">${this.round + 1 >= this.questions.length ? '查看风味封号 ↗' : '下一题 ›'}</button>
            </div>`
          : ''
      }
    `;

    this.el.querySelector('#act-quiz-close').addEventListener('click', () => {
      this.close();
      this.onClose();
    });
    this.el.querySelector('#act-quiz-hint')?.addEventListener('click', () => {
      this.revealedClues = Math.min(3, this.revealedClues + 1);
      this.render();
    });
    this.el.querySelector('#act-quiz-submit')?.addEventListener('click', () => this.submitGuess());
    this.el.querySelector('#act-quiz-next')?.addEventListener('click', () => this.nextRound());
  }

  renderSummary() {
    const avg = Math.round(this.score / this.questions.length);
    let rank = '寻味新秀';
    if (avg >= 85) rank = '御膳大总管 · 天下风物通';
    else if (avg >= 70) rank = '随园食客 · 九州老饕';
    else if (avg >= 50) rank = '运河寻味客';

    this.el.innerHTML = `
      <div class="quiz-top">
        <span class="mini-tag" style="background:#2f6b64;color:#fff">挑战结算</span>
        <span class="quiz-score">总分 ${this.score} / ${this.questions.length * 100}</span>
        <button type="button" class="icon-close" id="act-quiz-close" aria-label="退出挑战">✕</button>
      </div>
      <div class="quiz-summary">
        <div class="quiz-rank-badge">${esc(rank)}</div>
        <p>你在 ${this.questions.length} 道风味地理考题中斩获 <strong>${this.score} 分</strong>（均分 ${avg}）。</p>
        <div class="quiz-actions">
          <button type="button" class="rp-btn is-accent" id="act-quiz-again">再来一局</button>
          <button type="button" class="rp-btn" id="act-quiz-exit">返回浏览舆图</button>
        </div>
      </div>
    `;
    this.el.querySelector('#act-quiz-close').addEventListener('click', () => {
      this.close();
      this.onClose();
    });
    this.el.querySelector('#act-quiz-exit').addEventListener('click', () => {
      this.close();
      this.onClose();
    });
    this.el.querySelector('#act-quiz-again').addEventListener('click', () => {
      this.onFinish('replay');
    });
  }
}
