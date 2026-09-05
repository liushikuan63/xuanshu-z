# 批量抓取 quanxue.cn 麻衣相法全文
$UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
$OUT = 'd:\Java\GitHub\xuanshu-z\.tmp-corpus\ws\mayi-shenxiang.txt'
$BASE = 'https://www.quanxue.cn/qt_mingxiang/mayixf/mayixf'

$sb = New-Object System.Text.StringBuilder

# 首页（前言）
$html = (Invoke-WebRequest -Uri "${BASE}01.html" -UseBasicParsing -Headers @{'User-Agent'=$UA}).Content
$m = [regex]::Match($html, '(?s)<div[^>]*id="content"[^>]*>(.*?)</div>')
if ($m.Success) {
  $t = $m.Groups[1].Value -replace '<[^>]+>', '' -replace '&nbsp;', ' ' -replace '&amp;', '&'
  $t = [regex]::Replace($t, '\s+', ' ').Trim()
  [void]$sb.AppendLine("麻衣相法 前言")
  [void]$sb.AppendLine($t)
  [void]$sb.AppendLine('')
  Write-Output "OK 01 前言"
}

# 02-13 正文页面
for ($i = 2; $i -le 13; $i++) {
  $url = $BASE + $i.ToString('00') + '.html'
  try {
    $html = (Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 30 -Headers @{'User-Agent'=$UA}).Content
    $m = [regex]::Match($html, '(?s)<h1[^>]*>(.*?)</h1>')
    $title = if ($m.Success) { ($m.Groups[1].Value -replace '<[^>]+>', '').Trim() } else { "麻衣相法 卷$i" }
    $cm = [regex]::Match($html, '(?s)<div[^>]*id="content"[^>]*>(.*?)</div>')
    $body = if ($cm.Success) { $cm.Groups[1].Value } else { $html }
    $body = $body -replace '<script[^>]*>.*?</script>', '' -replace '<style[^>]*>.*?</style>', '' -replace '<!--.*?-->', ''
    $body = $body -replace '<br\s*/?>', "`n" -replace '</p>', "`n" -replace '</h[1-6]>', "`n"
    $body = $body -replace '<[^>]+>', '' -replace '&nbsp;', ' ' -replace '&amp;', '&'
    $body = $body -replace '&lt;', '<' -replace '&gt;', '>'
    $body = [regex]::Replace($body, '\s*\n\s*', "`n").Trim()
    if ($body.Length -gt 100) {
      [void]$sb.AppendLine($title)
      [void]$sb.AppendLine($body)
      [void]$sb.AppendLine('')
      Write-Output "OK $i $title ($($body.Length) 字)"
    } else {
      Write-Output "SKIP $i $title (内容过短: $($body.Length) 字)"
    }
  } catch {
    Write-Output "ERR $i $url"
  }
  Start-Sleep -Milliseconds 800
}

[System.IO.File]::WriteAllText($OUT, $sb.ToString(), (New-Object System.Text.UTF8Encoding $false))
Write-Output "WROTE $OUT ($($sb.Length) chars)"