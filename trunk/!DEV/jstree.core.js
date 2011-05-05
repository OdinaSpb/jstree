/*
 * jsTree 1.0-rc3
 * http://jstree.com/
 *
 * Copyright (c) 2010 Ivan Bozhanov (vakata.com)
 *
 * Licensed same as jquery - under the terms of either the MIT License or the GPL Version 2 License
 *   http://www.opensource.org/licenses/mit-license.php
 *   http://www.gnu.org/licenses/gpl.html
 *
 * $Date: 2010-11-04 12:27:14 +0200 (четв, 04 ноември 2010) $
 * $Revision: 232 $
 */

/*jslint browser: true, onevar: true, undef: true, bitwise: true, strict: true */
/*global window : false, clearInterval: false, clearTimeout: false, document: false, setInterval: false, setTimeout: false, jQuery: false, navigator: false, XSLTProcessor: false, DOMParser: false, XMLSerializer: false*/

/* File: jstree.core.js
The only required part of jstree it consists of a few functions bound to the $.jstree object, the actual plugin function and a few core functions for manipulating a tree.
*/
"use strict";
(function () { 
	if(!jQuery) { throw "jsTree: jQuery not included."; }
	if(jQuery.jstree) { return; }

/* Group: $.jstree. 
Some static functions and variables, unless you know exactly what you are doing do not use these, but <$().jstree> instead.
*/
(function ($) {
	var instances			= [],
		focused_instance	= -1,
		plugins				= {},
		functions			= {};
	/* 
		Variable: $.jstree
		*object* Contains all static functions and variables used by jstree, some plugins also append variables.
	*/
	$.jstree = { 
		/* 
			Variable: $.jstree.IS_IE6
				*boolean* indicating if the client is running Internet Explorer 6
		*/
		IS_IE6 : (jQuery.browser.msie && parseInt(jQuery.browser.version,10) === 6),

		/* 
			Variable: $.jstree.IS_IE7
				*boolean* indicating if the client is running Internet Explorer 7
		*/
		IS_IE7 : (jQuery.browser.msie && parseInt(jQuery.browser.version,10) === 6),

		/*
			Variable: $.jstree.IS_FF2
				*boolean* indicating if the client is running Firefox 2
		*/
		IS_FF2 : (jQuery.browser.mozilla && parseFloat(jQuery.browser.version,10) < 1.9),

		/* 
			Function: $.jstree.__construct
				Creates a new jstree instance, any arguments after the first one are merged and used to configure the tree.

				`.data("jstree")` is also called on the container and is used for configuration (keep in mind you can specify this data using a "data-jstree" attribute)

			Parameters:
				container - *mixed* the container of the tree (this should not be the UL node, but a wrapper) - DOM node, jQuery object or selector
		*/
		__construct	: function (container) {
			var s = {}, // settings
				d = {}, // data
				p = [], // plugins
				t = [], // plugins temp
				i = 0;  // index
			container = $(container);
			if($.jstree._reference(container)) { $.jstree.__destruct(container); }
			$.extend.apply(null, [true, s].concat(Array.prototype.slice.call(arguments, 1), (container.data("jstree") || {}) ));
			p = $.isArray(s.plugins) ? s.plugins : $.jstree.defaults.plugins.slice();
			p = p.sort().join(",,").replace(/(,|^)([^,]+)(,,\2)+(,|$)/g,"$1$2$4").replace(/,,+/g,",").replace(/,$/,"").split(",");
			s = $.extend(true, {}, $.jstree.defaults, s);
			$.each(plugins, function (i, val) { 
				if(i !== "core" && $.inArray(i, s.plugins) === -1) { s[i] = null; delete s[i]; } 
				else { t.push(i); d[i] = {}; }
			});
			s.plugins = t;
			i = parseInt(instances.push({}),10) - 1;
			container
				.data("jstree-instance-id", i)
				.addClass("jstree jstree-" + i);

			this.data				= d;
			this.get_index			= function () { return i; };
			this.get_container		= function () { return container; };
			this.get_container_ul	= function () { return container.children("ul:eq(0)"); };
			this.get_settings		= function (writable) { return writable ? s : $.extend(true, {}, s); };
			this.__trigger			= function (ev, data) { 
				if(!ev) { return; }
				if(!data) { data = {}; }
				if(typeof ev === "string") { ev = ev.replace(".jstree","") + ".jstree"; }
				data.inst = this;
				this.get_container().triggerHandler(ev, data);
			};
			instances[i] = this;
			$.each(t, function (j, val) { if(plugins[val]) { plugins[val].__construct.apply(instances[i]); } });
			this.__trigger("__construct");
			$.jstree._focus(i);
			return this;
		},
		/*
			Group: $.jstree. 

			Function: $.jstree.__destruct
				Destroys an instance, and also clears `jstree-` prefixed classes and all events in the `jstree` namespace

			Parameters:
				instance - *mixed* the instance to destroy (this argument is passed to <$.jstree._reference> to get the instance)

			See also:
				<$.jstree._reference>
		*/
		__destruct	: function (instance) {
			instance = $.jstree._reference(instance);
			if(!instance) { return false; }
			var s = instance._get_settings(),
				n = instance.get_index(),
				i = 0;
			if(focused_instance === n) {
				for(i in instances) { 
					if(instances.hasOwnProperty(i) && i != n) { 
						$.jstree._focus(i);
						break; 
					} 
				}
				if(focused_instance === n) { $.jstree._focus(false); }
			}
			$.each(s.plugins, function (i, val) {
				try { plugins[val].__destruct.apply(instance); } catch(err) { }
			});
			this.__trigger("__destruct");
			instance.get_container()
				.unbind(".jstree")
				.undelegate(".jstree")
				.removeData("jstree-instance-id")
				.find("[class^='jstree']")
					.andSelf()
					.attr("class", function () { return this.className.replace(/jstree[^ ]*|$/ig,''); });
			$(document)
				.unbind(".jstree-" + n)
				.undelegate(".jstree-" + n);
			delete instances[n];
			return true;
		},
		/* 
			Function: $.jstree.__call
				Call a function on the instance and return the result
		
			Parameters:
				instance - *mixed* the instance to destroy (this argument is passed to <$.jstree._reference> to get the instance)
				operation - *string* the operation to execute
				args - *array* the arguments to pass to the function
		
			See also:
				<$.jstree._reference>
		*/
		__call		: function (instance, operation, args) {
			instance = $.jstree._reference(instance);
			if(!instance || !$.isFunction(instance, operation)) { return; }
			return instance[operation].apply(instance, args);
		},
		/* 
			Function: $.jstree._reference
				Returns an instance
		
			Parameters:
				needle - *mixed* - integer, DOM node contained inside a jstree container, ID string, jQuery object, selector
		*/
		_reference	: function (needle) { 
			if(instances[needle]) { return instances[needle]; }
			var o = $(needle); 
			if(!o.length && typeof needle === "string") { o = $("#" + needle); }
			if(!o.length) { return null; }
			return instances[o.closest(".jstree").data("jstree-instance-id")] || null; 
		},
		/*
			Function: $.jstree._focused
				Returns the currently focused instance (by default once an instance is created it is focused)
		*/
		_focused	: function () {
			return instances[focused_instance] || null; 
		},
		/*
			Function: $.jstree._focus
				Make an instance focused (which defocuses the previously focused instance)
		
			Parameters:
				instance - *mixed* the instance to focus (this argument is passed to <$.jstree._reference> to get the instance)
		
			See also:
				<$.jstree._reference>
		*/
		_focus		: function (instance) {
			if(instance === false) {
				instances[focused_instance].get_container().removeClass("jstree-focused");
				instances[focused_instance].__trigger("_defocus");
				focused_instance = -1;
				return false;
			}
			instance = $.jstree._reference(instance);
			if(!instance || instance.get_index() === focused_instance) { return false; }
			if(focused_instance !== -1) {
				instances[focused_instance].get_container().removeClass("jstree-focused");
				instances[focused_instance].__trigger("_defocus");
			}
			focused_instance = instance.get_index();
			instance.get_container().addClass("jstree-focused");
			instance.__trigger("_focus");
			return true;
		},
		/*
			Function: $.jstree.plugin
				Register a plugin
		
			Parameters:
				plugin_name - *string* the name of the new plugin (it will be used as a key in an object - make sure it is valid)
				plugin_data - *object* consists of 4 keys. Default is:
				>{ 
				>	__construct	: $.noop,	// this function will be executed when a new instance is created
				>	__destuct	: $.noop,	// this function will be executed when an instance is destroyed
				>	_fn			: { },		// each key of this object should be a function that will extend the jstree prototype
				>	defaults	: false		// the default configuration for the plugin (if any)
				>}
		*/
		plugin		: function (plugin_name, plugin_data) {
			plugin_data = $.extend({}, {
					__construct	: $.noop, 
					__destuct	: $.noop,
					_fn			: { },
					defaults	: false
				}, plugin_data);
			plugins[plugin_name]			= plugin_data;
			$.jstree.defaults[plugin_name]	= plugin_data.defaults;
			$.each(plugin_data._fn, function (i, val) {
				val.plugin		= plugin_name;
				val.old			= functions[i];
				functions[i]	= function () {
					var rslt,
						func = val,
						args = Array.prototype.slice.call(arguments),
						evnt = new $.Event("before.jstree"),
						plgn = this.get_settings(true).plugins;

					do {
						if(func && func.plugin && $.inArray(func.plugin, plgn) !== -1) { break; }
						func = func.old;
					} while(func);
					if(!func) { return; }

					if(i.indexOf("_") === 0) {
						rslt = func.apply(this, args);
					}
					else {
						rslt = this.__trigger(evnt, { "func" : i, "args" : args, "plugin" : func.plugin });
						if(rslt === false) { return; }
						rslt = func.apply(
							$.extend({}, this, { 
								__callback : function (data) { 
									this.__trigger( i, { "args" : args, "rslt" : data, "plugin" : func.plugin });
									return data;
								},
								__call_old : function (replace_arguments) {
									return func.old.apply(this, (replace_arguments ? Array.prototype.slice.call(arguments, 1) : args ) );
								}
							}), args);
					}
					return rslt;
				};
				functions[i].old	= val.old;
				functions[i].plugin	= plugin_name;
			});
		},
		/*
			Variable: $.jstree.defaults
				*object* storing all the default configuration options for every plugin and the core. 
				If this is modified all instances created after the modification, which do not explicitly specify some other value will use the new default.
			
			Example:
			>// this instance will use the _default_ theme
			>$("#div0").jstree({ plugins : ["themes"] }); 
			>$.jstree.defaults.themes.theme = "classic";
			>// this instance will use the _classic_ theme
			>$("#div1").jstree({ plugins : ["themes"] }); 
			>// this instance will use the _apple_ theme
			>$("#div2").jstree({ themes : { "theme" : "apple" }, plugins : ["themes"] }); 
		*/
		defaults	: { 
			plugins : []
		}
	};
	/* Group: $().jstree()
		The actual plugin wrapper, use this to create instances or execute functions on created instances.

		Function: $().jstree

		Creates an instance using the specified objects for containers, or executes a command on an instance, specified by a container.

		Parameters:
			settings - *mixed* 
			
			- if you pass an *object* a new instance will be created (using <$.jstree.__construct>) 
			for each of the objects in the jquery collection, 
			if an instance already exists on the container it will be destroyed first
			
			- if you pass a *string* it will be executed using <$.jstree.__call> on each instance

		Examples:
			> // this creates an instance
			> $("#some-id").jstree({ 
			>	plugins : [ "html_data", "themes", "ui" ]
			> });
			>
			> // this executes a function on the instance
			> $("#some-id").jstree("select_node", "#the-id-to-select");

		See also:
			<$.jstree.__construct>, 
			<$.jstree.__destruct>, 
			<$.jstree.__call>
	*/
	$.fn.jstree = function (settings) {
		var _is_method	= (typeof settings == 'string'), 
			_arguments	= Array.prototype.slice.call(arguments, 1), 
			_return		= this;
		this.each(function () {
			if(_is_method) {
				var val = $.jstree.__call(this, settings, _arguments);
				if(typeof val !== "undefined" && (settings.indexOf("is_" === 0) || (val !== true && val !== false))) {
					_return = val;
					return false;
				}
			}
			else {
				_is_method = new $.jstree.__construct(this, settings);
			}
		});
		return _return;
	};
	functions = $.jstree.__construct.prototype;
})(jQuery);
//*/

(function ($) {
	$(function() {
		var e1, e2;
		if (/msie/.test(navigator.userAgent.toLowerCase())) {
			e1 = $('<textarea cols="10" rows="2"></textarea>').css({ position: 'absolute', top: -1000, left: 0 }).appendTo('body');
			e2 = $('<textarea cols="10" rows="2" style="overflow: hidden;"></textarea>').css({ position: 'absolute', top: -1000, left: 0 }).appendTo('body');
				/* 
					Group: $.jstree.

					Variable: $.jstree.SCROLLBAR_WIDTH
						*integer* indicating the width of the client scrollbar
				*/
			$.jstree.SCROLLBAR_WIDTH = e1.width() - e2.width();
			e1.add(e2).remove();
		} 
		else {
			e1 = $('<div />').css({ width: 100, height: 100, overflow: 'auto', position: 'absolute', top: -1000, left: 0 })
					.prependTo('body').append('<div />').find('div').css({ width: '100%', height: 200 });
			$.jstree.SCROLLBAR_WIDTH = 100 - e1.width();
			e1.parent().remove();
		}
	});

	$.jstree.plugin("core", {
		__construct : function () {
			this.data.core.rtl = (this.get_container().css("direction") === "rtl");
			if(this.data.core.rtl) { this.get_container().addClass("jstree-rtl"); }

			this.get_container()
				.bind("__construct.jstree", $.proxy(function () {
						this.init();
					}, this))
				.bind("before.jstree", $.proxy(function (e, data) {
						if(!/^is_locked|unlock$/.test(data.func) && this.data.core.locked) {
							e.stopImmediatePropagation();
							return false;
						}
					}, this))
				.bind("load_node.jstree", $.proxy(function (e, data) {
						this.clean_node(data.rslt.obj);
					}, this))
				.bind("__loaded.jstree", $.proxy(function (e, data) {
						data.inst.get_container_ul().children('li').each(function () {
							data.inst.correct_node(this);
						});
					}, this))
				.bind("open_node.jstree", $.proxy(function (e, data) {
						data.rslt.obj.find('> ul > li').each(function () {
							data.inst.correct_node(this);
						});
					}, this))
				.bind("mousedown.jstree", $.proxy(function () { 
						$.jstree._focus(this.get_index());
					}, this))
				.bind("dblclick.jstree", function () { 
						if(document.selection && document.selection.empty) { document.selection.empty(); }
						else { if(window.getSelection) { var sel = window.getSelection(); try { sel.removeAllRanges(); sel.collapse(); } catch (er) { } } }
					})
				.delegate("li > ins", "click.jstree", $.proxy(function (e) {
						var trgt = $(e.target);
						if(trgt.is("ins") && e.pageY - trgt.offset().top < this.data.core.li_height) { this.toggle_node(trgt); }
					}, this));
		},
		__destruct : function () { 
			
		},
		/* Class: jstree */
		/*
			Variable: data
			*object* Provides storage for plugins (aside from private variables). Every plugin has an key in this object.
			> this.data.<plugin_name>;
			This is useful for detecting if some plugin is included in the instance (plugins also use this for dependencies and enhancements).

			Function: get_index
			Returns an *integer*, which is the instance's index. Every instance on the page has an unique index, when destroying an intance the index will not be reused.

			Function: get_container
			Returns the jQuery extended container of the tree (the element you used when constructing the tree).

			Function: get_container_ul
			Returns the jQuery extended first UL node inside the container of the tree.

			Function: get_settings
			Returns the settings for the tree.

			Parameters:
				writable - *boolean* whether to return a copy of the settings object or a reference to it.

			Example:
			> $("#div1").jstree("get_settings"); // will return a copy
			> $.jstree._reference("#div1").get_settings(); // same as above
			> $.jstree._focused().get_settings(true); // a reference. BE CAREFUL!

			Function: __trigger
			Used internally to trigger events on the container node.

			Parameters:
				event_name - the name of the event to trigger (the *jstree* namespace will be appended to it)
				data - the additional object to pass along with the event. By default _data.inst_ will be the current instance, so when you bind to the event, you can access the instance easily.
				> $("div").bind("some-event.jstree", function (e, data) { data.inst.some_function(); });
		*/
		/* 
			Group: CORE options

			Variable: config.core.strings
			*mixed* used to store all localization strings. Default is _false_.

			Example 1: 
			>$("div").jstree({
			>	core : { 
			>		strings : function (s) {
			>			if(s === "Loading ...") { s = "Please wait ..."; }
			>			return s;
			>		}
			>	}
			>});

			Example 2: 
			>$("div").jstree({
			>	core : { 
			>		strings : {
			>			"Loading ..." : "Please wait ..."
			>		}
			>	}
			>});

			See also:
			<_get_string>
		*/
		defaults : { 
			strings : false
		},
		_fn : { 
			/* 
				Group: CORE functions

				Function: _get_string
				Used to get the common string in the tree. 

				If <config.core.strings> is set to a function, that function is called with a single parameter (the needed string), the response is returned.

				If <config.core.strings> is set to an object, the key named as the needed string is returned.

				If <config.core.strings> is not set, the the needed string is returned.

				Parameters:
					needed_string - *string* the needed string
			*/
			_get_string : function (s) { 
				var a = this.get_settings(true).core.strings;
				if($.isFunction(a)) { return a.call(this, s); }
				if(a && a[s]) { return a[s]; }
				return s; 
			},

			/* 
				Function: init
				Used internally. This function is called once the core plugin is constructed.

				Triggers:
				<__loaded>

				Event: __loaded
				This event is triggered in the *jstree* namespace when data is first rendered in the tree. It won't be triggered after a refresh. Fires only once.

				Parameters:
					data.inst - the instance
				
				Example:
				> $("div").bind("__loaded.jstree", function (e, data) { data.inst.do_something(); });
			*/
			init : function () { 
				this.data.core.original_container_html = this.get_container().find(" > ul > li").clone(true);
				this.data.core.original_container_html.find("li").andSelf().contents().filter(function() { return this.nodeType == 3 && (!this.nodeValue || /^\s+$/.test(this.nodeValue)); }).remove();
				this.get_container().html("<ul><li class='jstree-loading'><a href='#'>" + this._get_string("Loading ...") + "</a></li></ul>");
				this.clean_node(-1);
				this.data.core.li_height = this.get_container_ul().children("li:eq(0)").height() || 18;
				this.load_node(-1, function () { 
					this.__trigger("__loaded");
				});
			},
			/* 
				Function: lock
				Used to lock the tree. When the tree is in a locked state, no functions can be called on the instance (except <is_locked> and <unlock>).
				Additionally a _jstree-locked_ class is applied on the container.

				Triggers:
				<lock>

				Event: lock
				This event is triggered in the *jstree* namespace when the tree is locked.

				Parameters:
					data.inst - the instance
					data.args - *array* the arguments passed to the function
					data.plugin - *string* the function's plugin (here it will be _"core"_ but if the function is extended it may be something else).
					data.rslt - _null_
				
				Example:
				> $("div").bind("lock.jstree", function (e, data) { data.inst.do_something(); });
			*/
			lock : function () { 
				this.data.core.locked = true; 
				this.get_container().addClass("jstree-locked"); 
				this.__callback(); 
			},
			/* 
				Function: unlock
				Used to unlock the tree. Instance can be used normally again. The _jstree-locked_ class is removed from the container.

				Triggers:
				<unlock>

				Event: unlock
				This event is triggered in the *jstree* namespace when the tree is unlocked.

				Parameters:
					data.inst - the instance
					data.args - *array* the arguments passed to the function
					data.plugin - *string* the function's plugin (here it will be _"core"_ but if the function is extended it may be something else).
					data.rslt - _null_
				
				Example:
				> $("div").bind("unlock.jstree", function (e, data) { data.inst.do_something(); });
			*/
			unlock : function () { 
				this.data.core.locked = false; 
				this.get_container().removeClass("jstree-locked"); 
				this.__callback(); 
			},
			/* 
				Function: is_locked
				Used to get the locked status of the tree.

				Returns:
					locked - *boolean* _true_ if tree is locked, _false_ otherwise
			*/
			is_locked : function () { 
				return this.data.core.locked; 
			},

			/* 
				Function: get_node
				Get a hold of the LI node (which represents the jstree node).

				Parameters:
					obj - *mixed* this is used as a jquery selector - can be jQuery object, DOM node, string, etc.
				
				Returns:
					jquery collection - node was found, the collection contains the LI node
					-1 - the tree container was referenced
					false - on failure (obj is not part of a tree, or does not exists in the DOM)
			*/
			get_node : function (obj) { 
				var $obj = $(obj, this.get_container()); 
				if($obj.is(".jstree") || obj == -1) { return -1; } 
				$obj = $obj.closest("li", this.get_container()); 
				return $obj.length ? $obj : false; 
			},

			/* 
				Function: get_next
				Get the next sibling of a node

				Parameters:
					obj - *mixed* this is used as a jquery selector - can be jQuery object, DOM node, string, etc.
					strict - *boolean* if set to _true_ jstree will only return immediate siblings, otherwise, if _obj_ is the last child of its parent, the parent's next sibling is returned.

				Returns:
					jquery collection - node was found, the collection contains the LI node
					-1 - the tree container was referenced
					false - node was not found, or failure (obj is not part of a tree, or does not exists in the DOM)
			*/
			get_next : function (obj, strict) {
				obj = this.get_node(obj);
				if(obj === -1) { return this.get_container_ul().children("li:eq(0)"); }
				if(!obj || !obj.length) { return false; }
				if(strict) { return (obj.nextAll("li").size() > 0) ? obj.nextAll("li:eq(0)") : false; }
				if(obj.hasClass("jstree-open")) { return obj.find("li:eq(0)"); }
				else if(obj.nextAll("li").size() > 0) { return obj.nextAll("li:eq(0)"); }
				else { return obj.parentsUntil(".jstree","li").next("li").eq(0); }
			},
			/* 
				Function: get_prev
				Get the previous sibling of a node

				Parameters:
					obj - *mixed* this is used as a jquery selector - can be jQuery object, DOM node, string, etc.
					strict - *boolean* if set to _true_ jstree will only return immediate siblings, otherwise, if _obj_ is the first child of its parent, the parent's previous sibling is returned.

				Returns:
					jquery collection - node was found, the collection contains the LI node
					-1 - the tree container was referenced
					false - node was not found, or failure (obj is not part of a tree, or does not exists in the DOM)
			*/
			get_prev : function (obj, strict) {
				obj = this.get_node(obj);
				if(obj === -1) { return this.get_container().find("> ul > li:last-child"); }
				if(!obj || !obj.length) { return false; }
				if(strict) { return (obj.prevAll("li").length > 0) ? obj.prevAll("li:eq(0)") : false; }
				if(obj.prev("li").length) {
					obj = obj.prev("li").eq(0);
					while(obj.hasClass("jstree-open")) { obj = obj.children("ul:eq(0)").children("li:last"); }
					return obj;
				}
				else { var o = obj.parentsUntil(".jstree","li:eq(0)"); return o.length ? o : false; }
			},
			/* 
				Function: get_parent
				Get the parent of a node

				Parameters:
					obj - *mixed* this is used as a jquery selector - can be jQuery object, DOM node, string, etc.

				Returns:
					jquery collection - node was found, the collection contains the LI node
					-1 - when _obj_ was a root node
					false - on failure (obj is not part of a tree, or does not exists in the DOM)
			*/
			get_parent : function (obj) {
				obj = this.get_node(obj);
				if(obj == -1 || !obj || !obj.length) { return false; }
				var o = obj.parentsUntil(".jstree", "li:eq(0)");
				return o.length ? o : -1;
			},
			/* 
				Function: get_children
				Get all the children of a node

				Parameters:
					obj - *mixed* this is used as a jquery selector - can be jQuery object, DOM node, string, etc. If _-1_ is used all root nodes are returned.

				Returns:
					jquery collection - node was found, the collection contains the LI nodes of all immediate children
					false - on failure (obj is not part of a tree, or does not exists in the DOM)
			*/
			get_children	: function (obj) {
				obj = this.get_node(obj);
				if(obj === -1) { return this.get_container_ul().children("li"); }
				if(!obj || !obj.length) { return false; }
				return obj.find("> ul > li");
			},

			/* 
				Function: is_parent
				Check if a node is a parent.

				Parameters:
					obj - *mixed* this is used as a jquery selector - can be jQuery object, DOM node, string, etc.

				Returns:
					true - _obj_ has children or is closed (will be loaded)
					false - _obj_ is not a valid node or has no children (leaf node)
			*/
			is_parent	: function (obj) { obj = this.get_node(obj); return obj && obj !== -1 && (obj.find("> ul > li:eq(0)").length || obj.hasClass("jstree-closed")); },
			/* 
				Function: is_loaded
				Check if a node is loaded.

				Parameters:
					obj - *mixed* this is used as a jquery selector - can be jQuery object, DOM node, string, etc.

				Returns:
					true - _obj_ has children or is leaf
					false - _obj_ is currently loading or is not a leaf, but has no children
			*/
			is_loaded	: function (obj) { obj = this.get_node(obj); return obj && ( (obj === -1 && !this.get_container().find("> ul > li.jstree-loading").length) || ( obj !== -1 && !obj.hasClass('jstree-loading') && (obj.find('> ul > li').length || obj.hasClass('jstree-leaf')) ) ); },
			/* 
				Function: is_loading
				Check if a node is currently loading.

				Parameters:
					obj - *mixed* this is used as a jquery selector - can be jQuery object, DOM node, string, etc.

				Returns:
					true - _obj_ is currently loading
					false - _obj_ is not currently loading
			*/
			is_loading	: function (obj) { obj = this.get_node(obj); return obj && ( (obj === -1 && this.get_container().find("> ul > li.jstree-loading").length) || (obj !== -1 && obj.hasClass("jstree-loading")) ); },
			/* 
				Function: is_open
				Check if a node is currently open.

				Parameters:
					obj - *mixed* this is used as a jquery selector - can be jQuery object, DOM node, string, etc.

				Returns:
					true - _obj_ is currently open
					false - _obj_ is not currently open
			*/
			is_open		: function (obj) { obj = this.get_node(obj); return obj && obj !== -1 && obj.hasClass("jstree-open"); },
			/* 
				Function: is_closed
				Check if a node is currently closed.

				Parameters:
					obj - *mixed* this is used as a jquery selector - can be jQuery object, DOM node, string, etc.

				Returns:
					true - _obj_ is currently closed
					false - _obj_ is not currently closed
			*/
			is_closed	: function (obj) { obj = this.get_node(obj); return obj && obj !== -1 && obj.hasClass("jstree-closed"); },
			/* 
				Function: is_leaf
				Check if a node is a leaf node (has no children).

				Parameters:
					obj - *mixed* this is used as a jquery selector - can be jQuery object, DOM node, string, etc.

				Returns:
					true - _obj_ is a leaf node
					false - _obj_ is not a leaf node
			*/
			is_leaf		: function (obj) { obj = this.get_node(obj); return obj && obj !== -1 && obj.hasClass("jstree-leaf"); },
			/* 
				Function: load_node
				Load the children of a node.

				Parameters:
					obj - *mixed* this is used as a jquery selector - can be jQuery object, DOM node, string, etc. Use -1 to load the root nodes.
					callback - a function to be executed in the tree's scope. Receives two arguments: _obj_ (the same node used to call load_node), _status_ (a boolean indicating if the node was loaded successfully.

				Returns:
					true - _obj_ is a valid node and will try loading it
					false - _obj_ is not a valid node

				Triggers:
					<load_node>

				See also:
					<_load_node>

				Event: load_node
				This event is triggered in the *jstree* namespace when a node is loaded (succesfully or not).

				Parameters:
					data.inst - the instance
					data.args - *array* the arguments passed to the function
					data.plugin - *string* the function's plugin (here it will be _"core"_ but if the function is extended it may be something else).
					data.rslt - *object* which contains two keys _obj_ (the loaded node) and _status_ - whether the node was loaded successfully.
				
				Example:
				> $("div").bind("load_node.jstree", function (e, data) { if(data.rslt.status) { data.inst.open_node(data.rslt.obj); } });
			*/
			load_node	: function (obj, callback) {
				obj = this.get_node(obj);
				if(!obj) { callback.call(this, obj, false); return false; }
				if(obj !== -1) { obj.addClass("jstree-loading"); }
				this._load_node(obj, $.proxy(function (status) {
					if(obj !== -1) { obj.removeClass("jstree-loading"); }
					if(callback) { callback.call(this, status); }
					this.__callback({ "obj" : obj, "status" : status });
				}, this));
				return true;
			},
			/* 
				Function: _load_node
				Load the children of a node, but as opposed to <load_node> does not change any visual properties or trigger events. This function is used in <load_node> internally. The idea is for data source plugins to overwrite this function. 
				This implementation (from the *core*) only uses markup found in the tree container, and does not load async.

				Parameters:
					obj - *mixed* this is used as a jquery selector - can be jQuery object, DOM node, string, etc. Use -1 to load the root nodes.
					callback - a function to be executed in the tree's scope. Receives one argument: _status_ (a boolean indicating if the node was loaded successfully).
			*/
			_load_node	: function (obj, callback) {
				// if using async - empty the node first
				if(obj === -1) {
					this.get_container_ul().empty().append(this.data.core.original_container_html);
				}
				callback.call(null, true);
			},
			/* 
				Function: open_node
				Open a node so that its children are visible. If the node is not loaded try loading it first.

				Parameters:
					obj - *mixed* this is used as a jquery selector - can be jQuery object, DOM node, string, etc.
					callback - a function to be executed in the tree's scope. Receives two arguments: _obj_ (the node being opened) and _status_ (a boolean indicating if the node was opened successfully).
					animation - the duration in miliseconds of the slideDown animation. If not supplied the jQuery default is used. Please note that on IE6 a _0_ is enforced here due to performance issues.
				
				Triggers:
					<open_node>, <__after_open>

				Event: open_node
				This event is triggered in the *jstree* namespace when a node is successfully opened (but if animation is used this event is triggered BEFORE the animation completes). See <__after_open>.

				Parameters:
					data.inst - the instance
					data.args - *array* the arguments passed to the function
					data.plugin - *string* the function's plugin (here it will be _"core"_ but if the function is extended it may be something else).
					data.rslt - *object* which contains a single key: _obj_ (the opened node).
				
				Example:
				> $("div").bind("open_node.jstree", function (e, data) { 
				>   data.rslt.obj.find('> ul > .jstree-closed').each(function () { 
				>     data.inst.open_node(this); 
				>   }
				> });

				Event: __after_open
				This event is triggered in the *jstree* namespace when a node is successfully opened AFTER the animation completes). See <open_node>.

				Parameters:
					data.inst - the instance
					data.rslt - *object* which contains a single key: _obj_ (the opened node).
				
				Example:
				> $("div").bind("__after_open.jstree", function (e, data) { 
				>   data.rslt.obj.find('> ul > .jstree-closed').each(function () { 
				>     data.inst.open_node(this); 
				>   }
				> });
			*/
			open_node : function (obj, callback, animation) { 
				obj = this.get_node(obj);
				if(obj === -1 || !obj || !obj.length) { return false; }
				if(!this.is_closed(obj)) { if(callback) { callback.call(this, obj, false); } return false; }
				if(!this.is_loaded(obj)) { // TODO: is_loading?
					this.load_node(obj, function (o, ok) { 
						return ok ? this.open_node(o, callback, animation) : callback ? callback.call(this, o, false) : false;
					});
				}
				else {
					var t = this;
					obj
						.children("ul").css("display","none").end()
						.removeClass("jstree-closed").addClass("jstree-open") 
						// .children("ins").text("-").end()
						.children("ul").stop(true, true).slideDown( ($.jstree.IS_IE6 ? 0 : animation), function () { 
								this.style.display = ""; 
								t.__trigger("__after_open", { "rslt" : { "obj" : obj } }); 
							}); 
					if(callback) { callback.call(this, obj, true); }
					this.__callback({ "obj" : obj });
				}
			},
			/* 
				Function: close_node
				Close a node so that its children are not visible.

				Parameters:
					obj - *mixed* this is used as a jquery selector - can be jQuery object, DOM node, string, etc.
					animation - the duration in miliseconds of the slideDown animation. If not supplied the jQuery default is used. Please note that on IE6 a _0_ is enforced here due to performance issues.
				
				Triggers:
					<close_node>, <__after_close>

				Event: close_node
				This event is triggered in the *jstree* namespace when a node is closed (but if animation is used this event is triggered BEFORE the animation completes). See <__after_close>.

				Parameters:
					data.inst - the instance
					data.args - *array* the arguments passed to the function
					data.plugin - *string* the function's plugin (here it will be _"core"_ but if the function is extended it may be something else).
					data.rslt - *object* which contains a single key: _obj_ (the closed node).
				
				Example:
				> $("div").bind("close_node.jstree", function (e, data) { 
				>   data.rslt.obj.children('ul').remove();
				> });

				Event: __after_close
				This event is triggered in the *jstree* namespace when a node is closed AFTER the animation completes). See <close_node>.

				Parameters:
					data.inst - the instance
					data.rslt - *object* which contains a single key: _obj_ (the opened node).
				
				Example:
				> $("div").bind("__after_close.jstree", function (e, data) { 
				>   data.rslt.obj.children('ul').remove();
				> });
			*/
			close_node : function (obj, animation) { 
				obj = this.get_node(obj);
				if(!obj || !obj.length || !this.is_open(obj)) { return false; }
				var t = this;
				obj
					.children("ul").attr("style","display:block !important").end()
					.removeClass("jstree-open").addClass("jstree-closed")
					// .children("ins").text("+").end()
					.children("ul").stop(true, true).slideUp( ($.jstree.IS_IE6 ? 0 : animation), function () { 
						this.style.display = ""; 
						t.__trigger("__after_close", { "rslt" : { "obj" : obj } }); 
					});
				this.__callback({ "obj" : obj });
			},
			/* 
				Function: toggle_node
				If a node is closed - open it, if it is open - close it.

				Parameters:
					obj - *mixed* this is used as a jquery selector - can be jQuery object, DOM node, string, etc.
			*/
			toggle_node : function (obj) { 
				if(this.is_closed(obj)) { return this.open_node(obj); }
				if(this.is_open(obj)) { return this.close_node(obj); }
			},
			/* 
				Function: open_all
				Open all nodes from a certain node down.

				Parameters:
					obj - *mixed* this is used as a jquery selector - can be jQuery object, DOM node, string, etc. If _-1_ is used or is omitted all nodes in the tree are opened.
					animation - the duration of the slideDown animation when opening the nodes. If not set _0_ is enforced for performance issues.
					original_obj - used internally to keep track of the recursion - do not set manually!
				
				Triggers:
					<open_all>

				Event: open_all
				This event is triggered in the *jstree* namespace when an open_all call completes.

				Parameters:
					data.inst - the instance
					data.args - *array* the arguments passed to the function
					data.plugin - *string* the function's plugin (here it will be _"core"_ but if the function is extended it may be something else).
					data.rslt - *object* which contains a single key: _obj_ (the node used in the call).
				
				Example:
				> $("div").bind("open_all.jstree", function (e, data) { 
				>   alert('DONE');
				> });
			*/
			open_all : function (obj, animation, original_obj) {
				obj = obj ? this.get_node(obj) : -1;
				obj = !obj || obj === -1 ? this.get_container_ul() : obj;
				original_obj = original_obj || obj;
				var _this = this;
				obj = this.is_closed(obj) ? obj.find('li.jstree-closed').andSelf() : obj.find('li.jstree-closed');
				obj.each(function () { 
					_this.open_node(
						this, 
						_this.is_loaded(this) ? 
							false : 
							function(obj) { this.open_all(obj, animation, original_obj); }, 
						animation || 0
					); 
				});
				if(original_obj.find('li.jstree-closed').length === 0) { this.__callback({ "obj" : original_obj }); }
			},
			/* 
				Function: close_all
				Close all nodes from a certain node down.

				Parameters:
					obj - *mixed* this is used as a jquery selector - can be jQuery object, DOM node, string, etc. If _-1_ is used or is omitted all nodes in the tree are closed.
					animation - the duration of the slideDown animation when closing the nodes. If not set _0_ is enforced for performance issues.
				
				Triggers:
					<close_all>

				Event: close_all
				This event is triggered in the *jstree* namespace when a close_all call completes.

				Parameters:
					data.inst - the instance
					data.args - *array* the arguments passed to the function
					data.plugin - *string* the function's plugin (here it will be _"core"_ but if the function is extended it may be something else).
					data.rslt - *object* which contains a single key: _obj_ (the node used in the call).
				
				Example:
				> $("div").bind("close_all.jstree", function (e, data) { 
				>   alert('DONE');
				> });
			*/
			close_all : function (obj, animation) {
				obj = obj ? this._get_node(obj) : -1;
				var $obj = !obj || obj === -1 ? this.get_container_ul() : obj,
					_this = this;
				$obj = this.is_open($obj) ? $obj.find('li.jstree-open').andSelf() : $obj.find('li.jstree-open');
				$obj.each(function () { _this.close_node(this, animation || 0); });
				this.__callback({ "obj" : obj });
			},
			/* 
				Function: clean_node
				This function converts inserted nodes to the required by jsTree format. It takes care of converting a simple unodreder list to the internally used markup. 
				The core calls this function automatically when new data arrives (by binding to the <load_node> event).
				Each plugin may override this function to include its own markup, but keep in mind to do it like that:
				> clean_node : function(obj) {
				>  obj = this.__call_old();
				>  obj.each(function () { 
				>    // do your stuff here
				>  });
				> }

				Parameters:
					obj - *mixed* this is used as a jquery selector - can be jQuery object, DOM node, string, etc. If _-1_ is used or is omitted all nodes in the tree are cleaned.

				Returns:
					jQuery collection - the cleaned children of the original node.
			*/
			clean_node : function (obj) {
				// DETACH maybe inside the "load_node" function? But what about animations, etc?
				obj = this.get_node(obj);
				obj = !obj || obj === -1 ? this.get_container().find("li") : obj.find("li");
				var _this = this;
				return obj.each(function () {
					var t = $(this),
						d = t.data("jstree"),
						s = (d && d.opened) || t.hasClass("jstree-open") ? "open" : (d && d.closed) || t.children("ul").length ? "closed" : "leaf";
					t.removeClass("jstree-open jstree-closed jstree-leaf jstree-last");
					if(!t.children("a").length) { 
						t.contents().filter(function() { return this.nodeType == 3; }).wrapAll('<a href="#" />'); 
					}
					if(!t.children("ins.jstree-ocl").length) { 
						t.prepend("<ins class='jstree-icon jstree-ocl'>&#160;</ins>");
					}
					if(t.is(":last-child")) { 
						t.addClass("jstree-last"); 
					}
					switch(s) {
						case 'leaf':
							t.addClass('jstree-leaf'); 
							break;
						case 'closed':
							t.addClass('jstree-open'); 
							_this.close_node(t);
							break;
						case 'open':
							t.addClass('jstree-closed'); 
							_this.open_node(t); 
							break;
					}
					
					// _this.correct_node(t);
					/*
					NO NEED FOR THAT SINCE OPEN_NODE IS USED ABOVE
					if(s === "open" && !t.children("ul").length) { 
						_this.load_node(t); 
					}
					*/
				});
			},
			/* 
				Function: correct_node
				This function corrects the open/closed/leaf state as data changes (as the user interacts with the tree).
				The core calls this function automatically when a node is opened, deleted or moved.

				Parameters:
					obj - *mixed* this is used as a jquery selector - can be jQuery object, DOM node, string, etc. If _-1_ is used or is omitted the root nodes are processed.

				Returns:
					jQuery collection - the processed children of the original node.
			*/
			/* PROCESS SINGLE NODE (OR USE BOOLEAN single PARAM), CALL FROM CLEAN_NODE, LOSE THE EVENTS ABOVE */
			correct_node : function (obj, deep) { 
				obj = this.get_node(obj);
				if(!obj || (obj === -1 && !deep)) { return false; }
				obj = deep ? obj.find('li').andSelf() : obj;
				obj.each(function () {
					var obj = $(this);
					switch(!0) {
						case obj.hasClass("jstree-open") && !obj.find("> ul > li").length:
							obj.removeClass("jstree-open").addClass("jstree-leaf").children("ul").remove(); // children("ins").html("&#160;").end()
							break;
						case obj.hasClass("jstree-leaf") && obj.find("> ul > li").length:
							obj.removeClass("jstree-leaf").addClass("jstree-closed"); //.children("ins").html("+");
							break;
					}
					obj[obj.is(":last-child") ? 'addClass' : 'removeClass']("jstree-last");
				});
				return obj;
			},
			scroll_to_node : function (obj) {
				var c = this.get_container()[0], t;
				if(c.scrollHeight > c.offsetHeight) {
					obj = this.get_node(obj);
					if(!obj || obj === -1 || !obj.length || !obj.is(":visible")) { return; }
					t = obj.offset().top - this.get_container().offset().top;
					if(t < 0) { 
						c.scrollTop = c.scrollTop + t - 1; 
					}
					if(t + this.data.core.li_height + (c.scrollWidth > c.offsetWidth ? $.jstree.SCROLLBAR_WIDTH : 0) > c.offsetHeight) { 
						c.scrollTop = c.scrollTop + (t - c.offsetHeight + this.data.core.li_height + 1 + (c.scrollWidth > c.offsetWidth ? $.jstree.SCROLLBAR_WIDTH : 0)); 
					}
				}
			},

			get_state : function () { // TODO: scroll position, theme
				var state	= { 'open' : [], 'scroll' : { 'left' : this.get_container().scrollLeft(), 'top' : this.get_container().scrollTop() } };
				this.get_container_ul().find('.jstree-open').each(function () { if(this.id) { state.open.push(this.id); } });
				return state;
			},
			set_state : function (state, callback) {
				// console.log(state);
				var res = true, t, done = true;
				if(state) {
					if($.isArray(state.open)) {
						t = this;
						$.each(state.open, function (i, v) {
							v = document.getElementById(v);
							if(v) { 
								res = false; // there will be some async activity - so wait for it
								$.vakata.array_remove(state.open, i);
								if(!state.open.length) { delete state.open; }
								t.open_node(v, $.proxy(function () { this.set_state(state); }, t)); 
							}
						});
						if(res) { delete state.open; }
						this.set_state(state, callback);
						return false;
					}
					if(state.scroll) {
						if(state.scroll && typeof state.scroll.left !== 'undefined') { 
							this.get_container().scrollLeft(state.scroll.left); 
						}
						if(state.scroll && typeof state.scroll.top !== 'undefined') { 
							this.get_container().scrollTop(state.scroll.top); 
						}
						delete state.scroll;
						delete state.open;
						this.set_state(state, callback);
						return false;
					}

					$.each(state, function () { done = false; return false; });
					if(done) {
						console.log('DONE');
						if(callback) { callback.call(this); }
						this.__callback();
					}

					return true;
				}
				return false;
			},
			refresh : function () {
				this.data.core.state = this.get_state();
				this.load_node(-1, function (o, s) { 
					if(s) {
						this.set_state(this.data.state);
					}
					this.data.core.state = null;
				});
			}


			// create_node
			// remove_node
			// set_text
			// get_text
			// rename_node
			// move_node
		}
	});
	
	// add core CSS
	$(function() {
		var css_string = '' + 
				'.jstree ul, .jstree li { display:block; margin:0 0 0 0; padding:0 0 0 0; list-style-type:none; } ' + 
				'.jstree li { display:block; min-height:18px; line-height:18px; white-space:nowrap; margin-left:18px; min-width:18px; } ' + 
				'.jstree-rtl li { margin-left:0; margin-right:18px; } ' + 
				'.jstree > ul > li { margin-left:0px; } ' + 
				'.jstree-rtl > ul > li { margin-right:0px; } ' + 
				'.jstree .jstree-icon { display:inline-block; text-decoration:none; margin:0; padding:0; } ' + 
				'.jstree .jstree-ocl { width:18px; height:18px; text-align:center; line-height:18px; cursor:default; } ' + 
				'.jstree a { display:inline-block; line-height:16px; height:16px; color:black; white-space:nowrap; padding:1px 2px; margin:0; } ' + 
				'.jstree a:focus { outline: none; } ' + 
				'li.jstree-open > ul { display:block; } ' + 
				'li.jstree-closed > ul { display:none; } ';
		// Correct IE 6 (does not support the > CSS selector)
		if($.jstree.IS_IE6) { 
			try { document.execCommand("BackgroundImageCache", false, true); } catch (err) { } // prevents flickers
			css_string += '' + 
				'.jstree li { height:18px; margin-left:0; margin-right:0; } ' + 
				'.jstree li li { margin-left:18px; } ' + 
				'.jstree-rtl li li { margin-left:0px; margin-right:18px; } ' + 
				'li.jstree-open ul { display:block; } ' + 
				'li.jstree-closed ul { display:none !important; } ' + 
				'.jstree li a { display:inline; border-width:0 !important; padding:0px 2px !important; } ';
		}
		// Correct IE 7 (shifts anchor nodes onhover)
		if($.jstree.IS_IE7) { 
			css_string += '.jstree li a { border-width:0 !important; padding:0px 2px !important; } ';
		}
		// Correct ff2 lack of display:inline-block
		if($.jstree.IS_FF2) {
			css_string += '' + 
				'.jstree .jstree-icon { display:-moz-inline-box; } ' + 
				'.jstree li { line-height:12px; } ' + // WHY??
				'.jstree a { display:-moz-inline-box; } ';
				/* за темите
				'.jstree .jstree-no-icons .jstree-checkbox { display:-moz-inline-stack !important; } ';
				*/
		}
		// the default stylesheet
		$.vakata.css.add_sheet({ str : css_string, title : "jstree" });
	});
})(jQuery);
//*/

})();