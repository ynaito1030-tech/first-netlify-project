/* ============================================================
   採点ナビ — マークシート テンプレート生成
   設定を読み取り、A4 用紙イメージ（.sheet）を組み立てて表示する。
   ============================================================ */

(function () {
  'use strict';

  var STORAGE_KEY = 'saiten-navi.marksheet.settings.v1';

  /* 1 段あたりに収まる行数（A4 縦・実測ベース） */
  var ROWS_FIRST_PAGE_WITH_NOTES = 29;
  var ROWS_FIRST_PAGE           = 34;
  var ROWS_OTHER_PAGE           = 34;
  var ROWS_KEY_FIRST_PAGE       = 31;
  var ROWS_KEY_OTHER_PAGE       = 34;

  var LABEL_SETS = {
    alpha:      ['A', 'B', 'C', 'D', 'E'],
    alphaLower: ['a', 'b', 'c', 'd', 'e'],
    number:     ['1', '2', '3', '4', '5'],
    maru:       ['①', '②', '③', '④', '⑤']
  };

  var DEFAULTS = {
    examTitle: '定期テスト 解答用紙',
    examSubject: '',
    examDate: '',
    qCount: 50,
    choiceCount: 5,
    labelStyle: 'alpha',
    columnCount: 2,
    showLetters: true,
    stripe: true,
    fClass: true,
    fNumber: true,
    fName: true,
    fScore: true,
    fMarkers: true,
    fKey: false,
    notes: 'HBまたはBの鉛筆で、はみ出さないように塗りつぶしてください。\n' +
           '訂正するときは、消しゴムできれいに消してください。\n' +
           '1つの問題につき、マークは1つだけです。\n' +
           '用紙を折ったり汚したりしないでください。'
  };

  var CONTROLS = {
    examTitle:   { el: null, type: 'text' },
    examSubject: { el: null, type: 'text' },
    examDate:    { el: null, type: 'text' },
    qCount:      { el: null, type: 'int' },
    choiceCount: { el: null, type: 'int' },
    labelStyle:  { el: null, type: 'text' },
    columnCount: { el: null, type: 'int' },
    showLetters: { el: null, type: 'bool' },
    stripe:      { el: null, type: 'bool' },
    fClass:      { el: null, type: 'bool' },
    fNumber:     { el: null, type: 'bool' },
    fName:       { el: null, type: 'bool' },
    fScore:      { el: null, type: 'bool' },
    fMarkers:    { el: null, type: 'bool' },
    fKey:        { el: null, type: 'bool' },
    notes:       { el: null, type: 'text' }
  };

  var preview = document.getElementById('preview');
  var qCountOut = document.getElementById('qCountOut');

  /* ---------- 小さなヘルパー ---------- */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text !== undefined && text !== null) { node.textContent = text; }
    return node;
  }

  function labelsFor(settings) {
    var set = LABEL_SETS[settings.labelStyle] || LABEL_SETS.alpha;
    return set.slice(0, settings.choiceCount);
  }

  function noteLines(settings) {
    return settings.notes
      .split('\n')
      .map(function (line) { return line.trim(); })
      .filter(function (line) { return line.length > 0; });
  }

  /* ---------- 設定の読み書き ---------- */

  function readSettings() {
    var settings = {};
    Object.keys(CONTROLS).forEach(function (key) {
      var ctrl = CONTROLS[key];
      if (ctrl.type === 'bool') {
        settings[key] = ctrl.el.checked;
      } else if (ctrl.type === 'int') {
        settings[key] = parseInt(ctrl.el.value, 10);
      } else {
        settings[key] = ctrl.el.value;
      }
    });
    return settings;
  }

  function applySettings(settings) {
    Object.keys(CONTROLS).forEach(function (key) {
      var ctrl = CONTROLS[key];
      var value = settings[key];
      if (value === undefined) { return; }
      if (ctrl.type === 'bool') {
        ctrl.el.checked = !!value;
      } else {
        ctrl.el.value = String(value);
      }
    });
  }

  function save(settings) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      /* プライベートモードなどで保存できなくても動作は続ける */
    }
  }

  function load() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) { return null; }
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  /* ---------- ページ割り ---------- */

  /**
   * 1..total の番号を「ページ → 段」に振り分ける。
   * 段の中は上から下へ、ページの中は左の段から順に埋める。
   */
  function paginateRows(total, columnCount, rowsFirstPage, rowsOtherPage) {
    var pages = [];
    var next = 1;
    var pageIndex = 0;

    while (next <= total) {
      var rowsPerColumn = pageIndex === 0 ? rowsFirstPage : rowsOtherPage;
      var capacity = rowsPerColumn * columnCount;
      var remaining = total - next + 1;
      var onThisPage = Math.min(capacity, remaining);

      /* 段の高さをそろえるため、ページ内の行数を段数で均等割りする */
      var base = Math.floor(onThisPage / columnCount);
      var extra = onThisPage % columnCount;

      var columns = [];
      for (var c = 0; c < columnCount; c++) {
        var size = base + (c < extra ? 1 : 0);
        var numbers = [];
        for (var i = 0; i < size; i++) {
          numbers.push(next);
          next++;
        }
        columns.push(numbers);
      }

      pages.push(columns);
      pageIndex++;
    }

    return pages;
  }

  function paginate(settings) {
    var hasNotes = noteLines(settings).length > 0;
    return paginateRows(
      settings.qCount,
      settings.columnCount,
      hasNotes ? ROWS_FIRST_PAGE_WITH_NOTES : ROWS_FIRST_PAGE,
      ROWS_OTHER_PAGE
    );
  }

  /* ---------- 部品の組み立て ---------- */

  function buildMarkers() {
    return ['tl', 'tr', 'bl', 'br'].map(function (pos) {
      return el('div', 'marker marker--' + pos);
    });
  }

  function buildIdBox(labelText, extraClass) {
    var box = el('div', 'idbox' + (extraClass ? ' ' + extraClass : ''));
    box.appendChild(el('div', 'idbox__label', labelText));
    box.appendChild(el('div', 'idbox__space'));
    return box;
  }

  function buildHead(settings, pageNo, totalPages, isKey) {
    var head = el('header', 'sheet__head');

    var titleRow = el('div', 'sheet__titlerow');
    titleRow.appendChild(el('h2', 'sheet__title', settings.examTitle || '解答用紙'));

    var meta = el('div', 'sheet__meta');
    if (settings.examSubject) {
      meta.appendChild(el('span', null, '科目：' + settings.examSubject));
    }
    if (settings.examDate) {
      meta.appendChild(el('span', null, settings.examDate));
    }
    if (totalPages > 1 && !isKey) {
      meta.appendChild(el('span', null, pageNo + ' / ' + totalPages));
    }
    titleRow.appendChild(meta);
    head.appendChild(titleRow);

    /* 正答表は採点者が持つ 1 枚なので、児童生徒の記入欄は付けない */
    if (!isKey) {
      var idRow = el('div', 'idrow');
      if (settings.fClass)  { idRow.appendChild(buildIdBox('クラス')); }
      if (settings.fNumber) { idRow.appendChild(buildIdBox('出席番号')); }
      if (settings.fName)   { idRow.appendChild(buildIdBox('氏　名', 'idbox--grow')); }
      if (settings.fScore)  { idRow.appendChild(buildIdBox('得　点', 'idbox--score')); }
      if (idRow.childNodes.length > 0) { head.appendChild(idRow); }
    }

    return head;
  }

  function buildNotes(settings) {
    var lines = noteLines(settings);
    if (lines.length === 0) { return null; }

    var box = el('section', 'notes');
    box.appendChild(el('div', 'notes__title', '【記入上の注意】'));
    var list = el('ul');
    lines.forEach(function (line) {
      list.appendChild(el('li', null, line));
    });
    box.appendChild(list);
    return box;
  }

  function buildAnswerColumn(numbers, settings, labels) {
    var col = el('div', 'answers__col');

    var head = el('div', 'colhead');
    head.appendChild(el('div', 'colhead__num', '問'));
    var headOpts = el('div', 'colhead__opts');
    labels.forEach(function (label) {
      headOpts.appendChild(el('div', 'colhead__opt', label));
    });
    head.appendChild(headOpts);
    col.appendChild(head);

    numbers.forEach(function (n, index) {
      var isBand = settings.stripe
        && (n % 5 === 0)
        && index !== numbers.length - 1;

      var row = el('div', 'qrow' + (isBand ? ' qrow--band' : ''));
      row.appendChild(el('div', 'qrow__num', String(n)));

      var opts = el('div', 'qrow__opts');
      labels.forEach(function (label) {
        opts.appendChild(el('div', 'bubble', settings.showLetters ? label : ''));
      });
      row.appendChild(opts);
      col.appendChild(row);
    });

    return col;
  }

  function buildSheet(columns, settings, pageNo, totalPages) {
    var sheet = el('article', 'sheet');
    if (settings.fMarkers) {
      buildMarkers().forEach(function (m) { sheet.appendChild(m); });
    }

    sheet.appendChild(buildHead(settings, pageNo, totalPages, false));

    if (pageNo === 1) {
      var notes = buildNotes(settings);
      if (notes) { sheet.appendChild(notes); }
    }

    var labels = labelsFor(settings);
    var answers = el('section', 'answers');
    columns.forEach(function (numbers) {
      if (numbers.length === 0) { return; }
      answers.appendChild(buildAnswerColumn(numbers, settings, labels));
    });
    sheet.appendChild(answers);

    var foot = el('footer', 'sheet__foot');
    foot.appendChild(el('span', null, '採点ナビ / Saiten-navi'));
    foot.appendChild(el('span', null, '全 ' + settings.qCount + ' 問・' + settings.choiceCount + '択'));
    sheet.appendChild(foot);

    return sheet;
  }

  function buildKeyColumn(numbers) {
    var col = el('div', 'keygrid__col');

    var head = el('div', 'colhead colhead--key');
    head.appendChild(el('div', 'keyrow__num', '問'));
    head.appendChild(el('div', 'keyhead__answer', '正　答'));
    head.appendChild(el('div', 'keyhead__points', '配　点'));
    col.appendChild(head);

    numbers.forEach(function (n) {
      var row = el('div', 'keyrow');
      row.appendChild(el('div', 'keyrow__num', String(n)));
      row.appendChild(el('div', 'keyrow__blank'));
      row.appendChild(el('div', 'keyrow__pts'));
      col.appendChild(row);
    });

    return col;
  }

  function buildKeyGuide(settings) {
    var labels = labelsFor(settings);
    var guide = el('section', 'notes');
    guide.appendChild(el('div', 'notes__title', '【採点者記入欄】'));
    var list = el('ul');
    list.appendChild(el('li', null, '「正答」欄に ' + labels.join('・') + ' のいずれかを記入してください。'));
    list.appendChild(el('li', null, '「配点」欄に各問の点数を記入してください。'));
    guide.appendChild(list);
    return guide;
  }

  function buildKeySheets(settings) {
    /* 正答表はできるだけ少ない枚数に収めたいので、段数は問題数から決める */
    var columnCount = Math.max(1, Math.min(4, Math.ceil(settings.qCount / ROWS_KEY_FIRST_PAGE)));
    var pages = paginateRows(
      settings.qCount,
      columnCount,
      ROWS_KEY_FIRST_PAGE,
      ROWS_KEY_OTHER_PAGE
    );

    return pages.map(function (columns, index) {
      var pageNo = index + 1;
      var sheet = el('article', 'sheet sheet--key');
      if (settings.fMarkers) {
        buildMarkers().forEach(function (m) { sheet.appendChild(m); });
      }

      sheet.appendChild(buildHead(settings, pageNo, pages.length, true));
      if (pageNo === 1) {
        sheet.appendChild(buildKeyGuide(settings));
      }

      var grid = el('section', 'keygrid');
      columns.forEach(function (numbers) {
        if (numbers.length === 0) { return; }
        grid.appendChild(buildKeyColumn(numbers));
      });
      sheet.appendChild(grid);

      var foot = el('footer', 'sheet__foot');
      foot.appendChild(el('span', null, '採点ナビ / Saiten-navi'));
      foot.appendChild(el('span', null,
        pages.length > 1
          ? '正答表 ' + pageNo + ' / ' + pages.length
          : '合計配点　　　　点'));
      sheet.appendChild(foot);

      return sheet;
    });
  }

  /* ---------- 描画 ---------- */

  function render() {
    var settings = readSettings();
    qCountOut.textContent = String(settings.qCount);

    var pages = paginate(settings);
    var fragment = document.createDocumentFragment();

    pages.forEach(function (columns, index) {
      fragment.appendChild(buildSheet(columns, settings, index + 1, pages.length));
    });

    if (settings.fKey) {
      buildKeySheets(settings).forEach(function (sheet) {
        fragment.appendChild(sheet);
      });
    }

    preview.textContent = '';
    preview.appendChild(fragment);

    save(settings);
  }

  /* ---------- 起動 ---------- */

  function init() {
    Object.keys(CONTROLS).forEach(function (key) {
      CONTROLS[key].el = document.getElementById(key);
    });

    var saved = load();
    applySettings(saved || DEFAULTS);

    Object.keys(CONTROLS).forEach(function (key) {
      var node = CONTROLS[key].el;
      node.addEventListener('input', render);
      node.addEventListener('change', render);
    });

    document.getElementById('printBtn').addEventListener('click', function () {
      window.print();
    });

    document.getElementById('resetBtn').addEventListener('click', function () {
      applySettings(DEFAULTS);
      render();
    });

    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
