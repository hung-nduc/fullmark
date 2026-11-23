# fullmark: Tab completion for `quiz` and `fullmark` in PowerShell. Add this line to $PROFILE:
#   quiz shell-init powershell | Out-String | Invoke-Expression
# Each Tab runs `quiz __complete WORDS...`: one candidate per line (value, a tab, a description), then a directive line.
Register-ArgumentCompleter -Native -CommandName quiz, fullmark -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)
    $name = $commandAst.CommandElements[0].Extent.Text
    $words = @()
    foreach ($e in ($commandAst.CommandElements | Select-Object -Skip 1)) {
        if ($e.Extent.StartOffset -ge $cursorPosition) { break }
        $words += if ($e -is [System.Management.Automation.Language.StringConstantExpressionAst]) { $e.Value } else { $e.Extent.Text }
    }
    if ($wordToComplete -eq '') { $words += '' }
    $lines = @(& $name __complete @words 2>$null)
    if ($lines.Count -eq 0) { return }
    $directive = $lines[-1]
    foreach ($line in ($lines | Select-Object -SkipLast 1)) {
        $value, $text = $line -split "`t", 2
        $kind = if ($value.StartsWith('-')) { 'ParameterName' } else { 'ParameterValue' }
        [System.Management.Automation.CompletionResult]::new($value, $value, $kind, $(if ($text) { $text } else { $value }))
    }
    if ($directive -like ':files:*') {
        # files of that kind, and folders to go into them; `:nofile` and `:default` leave files to PowerShell
        $ext = $directive.Substring(7)
        $i = $wordToComplete.LastIndexOfAny([char[]]'/\')
        $dir = $wordToComplete.Substring(0, $i + 1)
        foreach ($f in @(Get-ChildItem -Path "$wordToComplete*" -ErrorAction SilentlyContinue)) {
            if (-not $f.PSIsContainer -and $f.Extension -ne ".$ext") { continue }
            $path = $dir + $f.Name + $(if ($f.PSIsContainer) { [IO.Path]::DirectorySeparatorChar })
            if ($path -match '\s') { $path = "'$path'" }
            [System.Management.Automation.CompletionResult]::new($path, $f.Name, 'ProviderItem', $path)
        }
    }
}
