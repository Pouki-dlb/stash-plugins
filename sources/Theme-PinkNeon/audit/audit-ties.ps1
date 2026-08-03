param([string]$Path)

$css = Get-Content -Raw $Path
$css = [regex]::Replace($css, '/\*.*?\*/', '', 'Singleline')

$rules = @(); $depth=0; $start=0; $selStart=0; $sel=''
for ($i=0; $i -lt $css.Length; $i++) {
  $ch = $css[$i]
  if ($ch -eq '{') { if ($depth -eq 0) { $sel = $css.Substring($selStart,$i-$selStart).Trim(); $start=$i+1 }; $depth++ }
  elseif ($ch -eq '}') { $depth--; if ($depth -eq 0) { if (-not $sel.StartsWith('@')) { $rules += [pscustomobject]@{Sel=($sel -replace '\s+',' ');Body=$css.Substring($start,$i-$start)} }; $selStart=$i+1 } }
}

function Get-Tokens([string]$s) {
  $t=@(); $rx='::[\w-]+|:[\w-]+(?:\([^)]*\))?|\.[\w-]+|#[\w-]+|\[[^\]]*\]|(?<=^|[\s>+~])[a-zA-Z][\w-]*'
  foreach ($m in [regex]::Matches($s,$rx)) { $t += $m.Value }; return $t
}
function Get-Spec($tokens) {
  $a=0;$b=0;$c=0
  foreach ($t in $tokens) {
    if ($t.StartsWith('#')) {$a++}
    elseif ($t.StartsWith('::')) {$c++}
    elseif ($t.StartsWith('.') -or $t.StartsWith('[') -or $t.StartsWith(':')) {$b++}
    else {$c++}
  }
  return @($a,$b,$c)
}

# une entree par selecteur, TOUS types (combinateurs inclus)
$items=@(); $order=0
foreach ($r in $rules) {
  $order++
  $decls=@{}
  foreach ($d in ($r.Body -split ';')) {
    if ($d -match '^\s*([-a-zA-Z]+)\s*:\s*(.+?)\s*$') {
      $p=$Matches[1].ToLower(); $v=$Matches[2]; $imp = $v -match '!important'
      $decls[$p]=[pscustomobject]@{Val=(($v -replace '!important','').Trim());Imp=$imp}
    }
  }
  if ($decls.Count -eq 0) { continue }
  foreach ($s in ($r.Sel -split ',')) {
    $s=$s.Trim(); if ($s -eq '') { continue }
    $parts = $s -split '[\s>+~]+'
    $last = $parts[-1]
    $lt = Get-Tokens $last
    $items += [pscustomobject]@{
      Sel=$s; Order=$order; Spec=(Get-Spec (Get-Tokens $s)); Decls=$decls
      LastClasses=@($lt | Where-Object {$_.StartsWith('.')})
      LastPseudos=@($lt | Where-Object {$_.StartsWith(':')} | Sort-Object)
      LastElem=(($lt | Where-Object {$_ -match '^[a-zA-Z]'}) -join '')
      HasCombinator=($s -match '[\s>+~]')
    }
  }
}

$found=@()
for ($i=0;$i -lt $items.Count;$i++) {
  for ($j=$i+1;$j -lt $items.Count;$j++) {
    $A=$items[$i]; $B=$items[$j]
    if ($A.Order -eq $B.Order) { continue }
    if ($A.Sel -eq $B.Sel) { continue }
    # on ne garde QUE les egalites strictes de poids : la ou seul l'ordre decide
    $eq = $true; for ($k=0;$k -lt 3;$k++) { if ($A.Spec[$k] -ne $B.Spec[$k]) { $eq=$false; break } }
    if (-not $eq) { continue }
    # au moins un des deux doit avoir un combinateur (la phase 1 a deja couvert le reste)
    if (-not ($A.HasCombinator -or $B.HasCombinator)) { continue }
    # meme element cible : meme etat, type compatible, une classe commune
    if (($A.LastPseudos -join '|') -ne ($B.LastPseudos -join '|')) { continue }
    if ($A.LastElem -ne '' -and $B.LastElem -ne '' -and $A.LastElem -ne $B.LastElem) { continue }
    $shared=@($A.LastClasses | Where-Object {$B.LastClasses -contains $_})
    if ($shared.Count -eq 0) { continue }
    foreach ($p in $A.Decls.Keys) {
      if (-not $B.Decls.ContainsKey($p)) { continue }
      $va=$A.Decls[$p]; $vb=$B.Decls[$p]
      if ($va.Val -eq $vb.Val) { continue }
      if ($va.Imp -ne $vb.Imp) { continue }   # !important tranche deja
      $perd = if ($A.Order -lt $B.Order) { $A } else { $B }
      $gagn = if ($A.Order -lt $B.Order) { $B } else { $A }
      $found += [pscustomobject]@{
        Prop=$p
        Perdant=($perd.Sel + '  = ' + $perd.Decls[$p].Val)
        Gagnant=($gagn.Sel + '  = ' + $gagn.Decls[$p].Val)
        Poids=($A.Spec -join ',')
      }
    }
  }
}

Write-Output ("selecteurs analyses (combinateurs inclus) : " + $items.Count)
Write-Output ""
if ($found.Count -eq 0) { Write-Output "Aucune egalite de poids conflictuelle." }
else {
  Write-Output ("=== " + $found.Count + " egalite(s) de poids ou seul l'ordre decide ===")
  Write-Output ""
  foreach ($f in ($found | Sort-Object Prop)) {
    Write-Output ($f.Prop + "   [poids " + $f.Poids + "]")
    Write-Output ("   perdant (ecrit avant) : " + $f.Perdant)
    Write-Output ("   gagnant (ecrit apres) : " + $f.Gagnant)
    Write-Output ""
  }
}
