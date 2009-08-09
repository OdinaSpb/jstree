(function ($) {
	$.extend($.tree.plugins, {
		"checkbox" : {
			defaults : {
				three_state : true,
				remove_clicked : true
			},
			callbacks : {
				// for three-state
				onchange : function(n, t) {
					var opts = $.extend(true, {}, $.tree.plugins.checkbox.defaults, this.settings.plugins.checkbox);
					if(n !== false && opts.three_state) {
						var $this = $(n);

						if($this.children("a").hasClass("checked")) {
							$this.find("li").andSelf().children("a").removeClass("checked undetermined").addClass("unchecked");
							var state = 0;
						}
						else {
							$this.find("li").andSelf().children("a").removeClass("unchecked undetermined").addClass("checked");
							var state = 1;
						}
						$this.parents("li").each(function () { 
							if(state == 1) {
								if($(this).children("ul").find("a.unchecked, a.undetermined").size() > 0) {
									$(this).parents("li").andSelf().children("a").removeClass("unchecked checked").addClass("undetermined");
									return false;
								}
								else $(this).children("a").removeClass("unchecked undetermined").addClass("checked");
							}
							else {
								if($(this).find("a.checked, a.undetermined").size() - 1 > 0) {
									$(this).parents("li").andSelf().children("a").removeClass("unchecked checked").addClass("undetermined");
									return false;
								}
								else $(this).children("a").removeClass("checked undetermined").addClass("unchecked");
							}
						});
					}
				},

				// for two-state only
				onselect : function(n, t) {
					var opts = $.extend(true, {}, $.tree.plugins.checkbox.defaults, this.settings.plugins.checkbox);
					
					if(opts.remove_clicked) $(n).children("a").removeClass("clicked");
					if(!opts.three_state) $(n).children("a").removeClass("unchecked").addClass("checked");
				},
				ondeselect : function(n, t) {
					var opts = $.extend(true, {}, $.tree.plugins.checkbox.defaults, this.settings.plugins.checkbox);
					if(!opts.three_state) $(n).children("a").removeClass("checked").addClass("unchecked");
				}
			}
		}
	});
})(jQuery);