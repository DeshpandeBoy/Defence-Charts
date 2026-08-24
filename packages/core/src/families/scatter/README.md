# Scatter family

Scatter uses the responsive ladder's plot and axes but replaces the primary mark with points.
The renderer preserves every defined point while the plan remains under the SVG point budget.
When the existing policy selects `renderer: 'canvas'`, the current family renderer fails explicitly
because no canvas mark renderer has shipped; it never silently samples the data.
