param([string]$Path)

$css = Get-Content -Raw $Path
$css = [regex]::Replace($css, '/\*.*?\*/', '', 'Singleline')

# --- extraction des blocs de premier niveau (selecteur { declarations }) ---
$rules = @()
$depth = 0; $start = 0; $selStart = 0
for ($i = 0; $i -lt $css.Length; $i++) {
  $ch = $css[$i]
  if ($ch -eq '{') {
    if ($depth -eq 0) { $sel = $css.Substring($selStart, $i - $selStart).Trim(); $start = $i + 1 }
    $depth++
  } elseif ($ch -eq '}') {
    $depth--
    if ($depth -eq 0) {
      $body = $css.Substring($start, $i - $start)
      if (-not $sel.StartsWith('@')) { $rules += [pscustomobject]@{ Sel = $sel; Body = $body } }
      $selStart = $i + 1
    }
  }
}

# --- tokenisation + specificite ---
function Get-Tokens([string]$s) {
  $t = @()
  $rx = '::[\w-]+|:[\w-]+(?:\([^)]*\))?|\.[\w-]+|#[\w-]+|\[[^\]]*\]|^[a-zA-Z][\w-]*'
  foreach ($m in [regex]::Matches($s, $rx)) { $t += $m.Value }
  return $t
}
function Get-Spec($tokens) {
  $a = 0; $b = 0; $c = 0
  foreach ($t in $tokens) {
    if ($t.StartsWith('#')) { $a++ }
    elseif ($t.StartsWith('::')) { $c++ }
    elseif ($t.StartsWith('.') -or $t.StartsWith('[') -or $t.StartsWith(':')) { $b++ }
    else { $c++ }
  }
  return @($a, $b, $c)
}
function Cmp-Spec($x, $y) {
  for ($i = 0; $i -lt 3; $i++) { if ($x[$i] -ne $y[$i]) { return $x[$i] - $y[$i] } }
  return 0
}

# --- aplatissement : une entree par selecteur simple (compound unique, sans combinateur) ---
$items = @()
$order = 0
foreach ($r in $rules) {
  $order++
  $decls = @{}
  foreach ($d in ($r.Body -split ';')) {
    if ($d -match '^\s*([-a-zA-Z]+)\s*:\s*(.+?)\s*$') {
      $prop = $Matches[1].ToLower()
      $val = $Matches[2]
      $imp = $val -match '!important'
      $val = ($val -replace '!important', '').Trim()
      $decls[$prop] = [pscustomobject]@{ Val = $val; Imp = $imp }
    }
  }
  if ($decls.Count -eq 0) { continue }
  foreach ($s in ($r.Sel -split ',')) {
    $s = $s.Trim()
    if ($s -eq '') { continue }
    if ($s -match '[\s>+~]') { continue }   # on ne garde que les compounds uniques
    $tok = Get-Tokens $s
    $items += [pscustomobject]@{
      Sel = $s; Order = $order; Tokens = $tok; Spec = (Get-Spec $tok); Decls = $decls
      Classes = @($tok | Where-Object { $_.StartsWith('.') })
      Pseudos = @($tok | Where-Object { $_.StartsWith(':') } | Sort-Object)
      Elem = ($tok | Where-Object { $_ -match '^[a-zA-Z]' }) -join ''
    }
  }
}

Write-Output ("selecteurs simples analyses : " + $items.Count)
Write-Output ""

# --- detection des conflits ---
$found = @()
for ($i = 0; $i -lt $items.Count; $i++) {
  for ($j = $i + 1; $j -lt $items.Count; $j++) {
    $A = $items[$i]; $B = $items[$j]
    if ($A.Order -eq $B.Order) { continue }
    if ($A.Sel -eq $B.Sel) { continue }
    # meme etat (pseudo-classes identiques) -> on compare comme pour comme
    if (($A.Pseudos -join '|') -ne ($B.Pseudos -join '|')) { continue }
    # types d'element compatibles
    if ($A.Elem -ne '' -and $B.Elem -ne '' -and $A.Elem -ne $B.Elem) { continue }
    # doivent partager au moins une classe -> meme famille d'elements
    $shared = @($A.Classes | Where-Object { $B.Classes -contains $_ })
    if ($shared.Count -eq 0) { continue }
    foreach ($p in $A.Decls.Keys) {
      if (-not $B.Decls.ContainsKey($p)) { continue }
      $va = $A.Decls[$p]; $vb = $B.Decls[$p]
      if ($va.Val -eq $vb.Val) { continue }        # meme valeur -> aucun symptome
      # qui gagne ?
      $winner = $null
      if ($va.Imp -and -not $vb.Imp) { $winner = 'A' }
      elseif ($vb.Imp -and -not $va.Imp) { $winner = 'B' }
      else {
        $c = Cmp-Spec $A.Spec $B.Spec
        if ($c -gt 0) { $winner = 'A' } elseif ($c -lt 0) { $winner = 'B' }
        else { $winner = if ($A.Order -lt $B.Order) { 'B' } else { 'A' } }
      }
      $loser = if ($winner -eq 'A') { $B } else { $A }
      $win = if ($winner -eq 'A') { $A } else { $B }
      $tie = (Cmp-Spec $A.Spec $B.Spec) -eq 0
      $found += [pscustomobject]@{
        Prop = $p
        Perdant = $loser.Sel + '  (' + ($loser.Spec -join ',') + ')  = ' + $loser.Decls[$p].Val
        Gagnant = $win.Sel + '  (' + ($win.Spec -join ',') + ')  = ' + $win.Decls[$p].Val
        Egalite = $tie
      }
    }
  }
}

if ($found.Count -eq 0) { Write-Output "Aucun conflit detecte." }
else {
  Write-Output ("=== " + $found.Count + " conflit(s) ===")
  Write-Output ""
  foreach ($f in ($found | Sort-Object -Property @{E={-not $_.Egalite}}, Prop)) {
    $tag = if ($f.Egalite) { "[EGALITE DE POIDS - l'ordre decide]" } else { "[poids differents]" }
    Write-Output ($tag + "  " + $f.Prop)
    Write-Output ("   perdant : " + $f.Perdant)
    Write-Output ("   gagnant : " + $f.Gagnant)
    Write-Output ""
  }
}
