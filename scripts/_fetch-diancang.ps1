# 可复用抓取：diancang.xyz 书库（整本/章节页 → raw 文本）
# 用法：
#   1) 书籍目录页（章节列表）: 先运行 Get-BookChapterUrls -BookUrl '<书目录页>' 获得章节 URL 列表
#   2) 直接抓取: Export-Book -Name <cid> -Urls @(url1, url2, ...) [-ExtraHeader <文件名后缀标题>]
# 输出：.tmp-corpus/ws/<Name>.txt（每章以「h1 标题」行开头，正文段落以空行分隔）

$UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
$ROOT = 'd:\Java\GitHub\xuanshu-z'
$OUT = Join-Path $ROOT '.tmp-corpus\ws'

function Get-Html($url) {
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 40 -Headers @{ 'User-Agent' = $UA }
    $c = $r.Content
    if ($c -is [System.Array]) { $c = [System.Text.Encoding]::UTF8.GetString($c) }
    return [string]$c
  } catch {
    return '<ERR> ' + $url
  }
}

function Strip-Tags([string]$html) {
  if (-not $html) { return '' }
  $t = $html
  $t = [regex]::Replace($t, '(?s)<script[^>]*>.*?</script>', ' ')
  $t = [regex]::Replace($t, '(?s)<style[^>]*>.*?</style>', ' ')
  $t = [regex]::Replace($t, '(?s)<!--.*?-->', ' ')
  $t = [regex]::Replace($t, '<br\s*/?>', "\n")
  $t = [regex]::Replace($t, '</p>', "\n")
  $t = [regex]::Replace($t, '</h1>|</h2>|</h3>|</h4>|</div>', "\n")
  $t = [regex]::Replace($t, '<[^>]+>', '')
  $t = $t -replace '&amp;', '&amp;' -replace '&lt;', '<' -replace '&gt;', '>' -replace '&quot;', '"' -replace "&nbsp;", ' '
  $t = [regex]::Replace($t, '[ \t　]+', ' ')
  $t = [regex]::Replace($t, '(\r?\n[ \t]*){2,}', "`n`n")
  return $t.Trim()
}

function Get-BookChapterUrls([string]$BookUrl) {
  $html = Get-Html $BookUrl
  if (-not $html) { return }
  $slug = [regex]::Match($BookUrl, 'xuanxuewushu/([^/?#]+)/?$').Groups[1].Value
  $links = [regex]::Matches($html, 'href="([^"]*xuanxuewushu/' + [regex]::Escape($slug) + '/\d+\.html)"') |
    ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
  $links | ForEach-Object { Write-Output $_ }
}

function Export-Book([string]$Name, [string[]]$Urls) {
  $sb = New-Object System.Text.StringBuilder
  foreach ($u in $Urls) {
    $html = Get-Html $u
    if (-not $html) { Write-Output "SKIP $u"; continue }
    # 取 <h1>…</h1> 标题
    $m = [regex]::Match($html, '(?s)<h1[^>]*>(.*?)</h1>')
    $title = if ($m.Success) { (Strip-Tags $m.Groups[1].Value) } else { '' }
    $cm = [regex]::Match($html, '(?s)<div id="content"[^>]*>(.*?)</div>')
    $body = if ($cm.Success) { Strip-Tags $cm.Groups[1].Value } else { '' }
    if (-not $body) { Write-Output "EMPTY $u"; continue }
    [void]$sb.AppendLine($title)
    [void]$sb.AppendLine($body)
    [void]$sb.AppendLine('')
    Write-Output "OK $u  ($(($body).Length) 字) title=$title"
    Start-Sleep -Milliseconds 400
  }
  $fp = Join-Path $OUT ($Name + '.txt')
  [System.IO.File]::WriteAllText($fp, $sb.ToString(), (New-Object System.Text.UTF8Encoding $false))
  Write-Output "WROTE $fp ($($sb.Length) chars)"
}

function Export-BookRange([string]$Name, [string]$UrlPrefix, [int]$StartId, [int]$EndId) {
  $sb = New-Object System.Text.StringBuilder
  for ($i = $StartId; $i -le $EndId; $i++) {
    $u = $UrlPrefix + $i + '.html'
    $html = Get-Html $u
    if (-not $html) { Write-Output "SKIP $u"; continue }
    $m = [regex]::Match($html, '(?s)<h1[^>]*>(.*?)</h1>')
    $title = if ($m.Success) { (Strip-Tags $m.Groups[1].Value) } else { '' }
    $cm = [regex]::Match($html, '(?s)<div id="content"[^>]*>(.*?)</div>')
    $body = if ($cm.Success) { Strip-Tags $cm.Groups[1].Value } else { '' }
    if (-not $body) { Write-Output "EMPTY $u"; continue }
    [void]$sb.AppendLine($title)
    [void]$sb.AppendLine($body)
    [void]$sb.AppendLine('')
    Write-Output "OK $u  ($($body.Length) 字)"
    Start-Sleep -Milliseconds 1200
  }
  $fp = Join-Path $OUT ($Name + '.txt')
  [System.IO.File]::WriteAllText($fp, $sb.ToString(), (New-Object System.Text.UTF8Encoding $false))
  Write-Output "WROTE $fp ($($sb.Length) chars)"
}

function Export-Gushu([string]$Name, [string]$BaseUrl, [int]$MaxPages) {
  # gushu.net.cn 页面结构：<div class="panel-body">…<span>正文<br/></span>…<nav class="pager">下一页链接</nav>
  $sb = New-Object System.Text.StringBuilder
  for ($p = 1; $p -le $MaxPages; $p++) {
    $u = if ($p -eq 1) { $BaseUrl } else { [regex]::Replace($BaseUrl, '\.html$', "-$p.html") }
    $html = Get-Html $u
    if (-not $html -or $html -like '<ERR>*') { Write-Output "END $u ($html)"; break }
    # 只取 panel-body 到 pager 之间的 span 正文
    $si = $html.IndexOf('class="panel-body"')
    $si = if ($si -ge 0) { $si } else { 0 }
    $ni = $html.IndexOf('class="pager"', $si)
    if ($ni -lt 0) { $ni = $html.Length }
    $seg = $html.Substring($si, $ni - $si)
    $body = Strip-Tags $seg
    if (-not $body) { Write-Output "EMPTY $u"; break }
    [void]$sb.AppendLine($body)
    [void]$sb.AppendLine('')
    $hasNext = $html -match '>下一页<'
    Write-Output "OK $u  ($($body.Length) 字) next=$hasNext"
    if (-not $hasNext) { break }
    Start-Sleep -Milliseconds 1000
  }
  $fp = Join-Path $OUT ($Name + '.txt')
  [System.IO.File]::WriteAllText($fp, $sb.ToString(), (New-Object System.Text.UTF8Encoding $false))
  Write-Output "WROTE $fp ($($sb.Length) chars)"
}

# ── 子命令入口 ──
$cmd = $args[0]
switch ($cmd) {
  'chapters' { Get-BookChapterUrls -BookUrl $args[1] }
  'export'   { Export-Book -Name $args[1] -Urls $args[2..($args.Length - 1)] }
  'range'    { Export-BookRange -Name $args[1] -UrlPrefix $args[2] -StartId ([int]$args[3]) -EndId ([int]$args[4]) }
  'gushu'    { Export-Gushu -Name $args[1] -BaseUrl $args[2] -MaxPages ([int]$args[3]) }
  default    { Write-Output 'usage: chapters <bookUrl> | export <name> <url...> | range <name> <urlPrefix> <start> <end> | gushu <name> <baseUrl> <maxPages>' }
}