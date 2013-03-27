/*
このjqueryプラグインは、
http://tockri.blog78.fc2.com/blog-entry-168.html
上記の作成者が作られたものをjqueryで使用できるよう書き換えたものです。
*/
(function($){
	$.fn.tagcheck=function(options){
		var defaults={
			iarea:"input-area",
			sout:"source-code",
			eout:"error-list"
		}

		var options=$.extend(defaults, options);

		/* module */
		var opened = {};
		var closed = {};
		var errors = [];
		var ignoring = [];

		// そもそも空要素のタグ
		var EMPTYTAG = ['img', 'link', 'meta', 'br', 'hr', 'input',
					'embed', 'area', 'base', 'basefont', 'bgsound',
					'param', 'wbr', 'col'];
		EMPTYTAG.indexOf = EMPTYTAG.indexOf || function(str) {
			for (var i = 0, l = this.length; i < l; i++) {
				if (this[i] == str) {
					return i;
				}
			}
			return -1;
		};

		var inIgnoring = function(index) {
			for (var i = 0; i < ignoring.length; i++) {
				var ig = ignoring[i];
				if (ig.head <= index && index < ig.tail) {
					return true;
				} else if (index < ig.head) {
					break;
				}
			}
			return false;
		}

		// 開いたまま閉じていないタグを検索する
		var checkClose = function(html){
			// 閉じタグの開始位置を返す
			var closure = function(html, index, tagName) {
				var closeRe = new RegExp("<(/)?" + tagName + "( [^>]*)?>", "igm");
				closeRe.lastIndex = index;
				var depth = 1;
				var r = null;
				while (r = closeRe.exec(html)) {
					if (r[1] == '/') {
						if (--depth == 0) {
							// すでに他の閉じタグになってる場合はfalse
							return closed[r.index] ? false : {
								head:r.index,
								tail:r.index + r[0].length
							};
						}
					} else {
						depth ++;
					}
				}
				return false;
			};
			var openPattern = /<([a-zA-Z1-9:]+)([^>]*)>/gm;
			var found = null;
			while(found = openPattern.exec(html)) {
				if (inIgnoring(found.index)) {
					continue;
				}
				var head = found.index;
				var tail = head + found[0].length;
				var tagName = found[1].toLowerCase();
				var attr = found[2];

				if (EMPTYTAG.indexOf(tagName) >= 0 || (attr && attr.charAt(attr.length - 1) == '/')) {
					// 空要素タグ
					closed[head] = {
						open: head,
						openTail: tail,
						close: head,
						closeTail: tail,
						tagName: tagName,
						attr: attr
					};
				} else {
					var cls = closure(html, tail, tagName);
					if (cls) {
						opened[head] = closed[cls.head] = {
							open: head,
							openTail: tail,
							close: cls.head,
							closeTail: cls.tail,
							tagName: tagName,
							attr: attr
						};
					} else {
						errors.push({
							id: errors.length,
							head:head,
							tail:tail,
							tagName: tagName,
							attr: attr,
							message: "タグが閉じていません"
						});
					}
				}
				openPattern.lastIndex = tail;
			}
		}/* checkClose end */

		// 開きタグがない閉じタグを検索する
		var checkOpen = function(html) {
			var closePattern = /<\/([a-zA-Z1-9:]+)>/gm;
			var found = null;
			while(found = closePattern.exec(html)) {
				if (inIgnoring(found.index)) {
					continue;
				}
				var head = found.index;
				var tail = head + found[0].length;
				var tagName = found[1].toLowerCase();
				var attr = '';
				if (EMPTYTAG.indexOf(tagName) < 0) {
					if (!closed[found.index]) {
						errors.push({
							id: errors.length,
							head:head,
							tail:tail,
							tagName: '/' + tagName,
							attr: attr,
							message: "開きタグがありません"
						});
					}
				}
				closePattern.lastIndex = tail;
			}
		}/* checkOpen end */

		// 先に開いたタグが先に閉じているような箇所がないかチェックする
		var checkSort = function() {
			var checked = [];
			for (var i in opened) {
				var cl = opened[i];
				for (var j = checked.length - 1; j >= 0; j--) {
					var ch = checked[j];
					if (ch.open < cl.open
						&& cl.open < ch.close
						&& ch.close < cl.close) {
						// 親開く-子開く-親閉じる-子閉じるの順
						errors.push({
							id: errors.length,
							head: ch.close,
							tail: ch.closeTail,
							tagName: '/' + ch.tagName,
							attr: '',
							message: '&lt;' + cl.tagName + cl.attr + '&gt;よりも先に閉じてしまっています'
						});
						errors.push({
							id: errors.length,
							head: cl.close,
							tail: cl.closeTail,
							tagName: '/' + cl.tagName,
							attr: '',
							message: '&lt;' + ch.tagName + ch.attr + '&gt;よりも後で閉じてしまっています'
						});
					} else if (ch.close < cl.open) {
						// 注目している地点ですでに閉じてるのはチェックから外す
						checked.splice(j, 1);
					}
				}
				checked.push(cl);
			}
		}

		// show sourcecode
		var showSourceCode = function(html) {
			var sourceLine = 1;
			// make source code html
			var re = function(htmlCode) {
				return htmlCode.replace(/[<>&\r\n \t]/g, function(c) {
					switch(c) {
					case '<':
						return '&lt;';
					case '>':
						return '&gt;';
					case '&':
						return '&amp;';
					case "\r":
						return '';
					case "\n":
						var cls = sourceLine % 2 == 0 ? 'e' : 'o';
						return '</div>\n<div class="ln">' + (++sourceLine)
								+ '</div><div class="' + cls + '">&nbsp;';
					case "\t":
						return "&nbsp;&nbsp;&nbsp;&nbsp;";
					case " ":
						return "&nbsp;";
					}
				});
			}
			var sourceCode = ['<div class="ln">1</div><div class="e">&nbsp;'];
			errors.sort(function(a, b) {
				return a.head - b.head;
			});
			var rular = 0;
			for (var i = 0, l = errors.length; i < l; i++) {
				var uc = errors[i];
				if (rular < uc.tail) {
					var head = re(html.substring(rular, uc.head));
					var tag = re(html.substring(uc.head, uc.tail));
					sourceCode.push(head,
									'<span class="error">',
									'<a id = "a' + uc.id + '"',
									' title="' + uc.message + '"',
									' href="javascript:void(0);">',
									tag,
									'</a></span>');
					uc.lineNumber = sourceLine;
					rular = uc.tail;
				}
			}
			sourceCode.push(re(html.substring(rular)), '<br clear="all">');

			return sourceCode.join("");
		}


		// show list
		var showList = function() {
			var listHTML = ['<ol>'];
			for (var i = 0, l = errors.length; i < l; i++) {
				var uc = errors[i];
				listHTML.push('<li>',
						'(' + uc.lineNumber + '行目) ',
						'<a id="d' + uc.id + '"',
						' href="javascript:void(0);">&lt;',
						uc.tagName + uc.attr,
						'&gt;</a> : ',
						uc.message,
						'</li>');
			}
			listHTML.push('</ol>');
			return listHTML.join("");
		}

		// 入力対象エリアでキーボード操作時の動作
		$('#' + options.iarea).keyup(function(){
			checkCommon();
		});
		
		// 表示時の動作
		$('html').load(function(){
			checkCommon();
		});
		
		// check処理
		var checkCommon = function(){
			opened = {};
			closed = {};
			errors = [];
			ignoring = [];

			// テキストエリア入力値取得
			var html = $('#' + options.iarea).val();

			// 閉じタグチェック
			checkClose(html);
			// 開きタグチェック
			checkOpen(html);
			// タグの閉じ順チェック
			// checkClose と checkOpenの結果を元に実行するので、必ず後に。
			checkSort();
			
			// エラーが一件以上あった場合のみ書き出し
			if(errors.length > 0){
				// ソースコードの表示
				var sourceCode = showSourceCode(html);
				$('#' + options.sout).html(sourceCode);
				// チェック結果の表示
				var errorList = showList();
				$('#' + options.eout).html(errorList);	
			}
		}

		return this;
	}
})(jQuery);