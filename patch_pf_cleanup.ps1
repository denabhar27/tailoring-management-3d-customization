$repairFile = 'c:\Users\den-a\SE\tailoring-management-user\src\admin\repair.jsx'
$custFile = 'c:\Users\den-a\SE\tailoring-management-user\src\admin\Customize.jsx'

# Fix repair.jsx - insert pricingFactors line after adminNotes (line 3645, 0-based)
$lines = [System.IO.File]::ReadAllLines($repairFile)
$pfLine = "                      pricingFactors: { ...pf2, enhancementRequest: false, enhancementPendingAdminReview: false, addAccessories: false, accessoriesPrice: null, accessoriesDeclineReason: null }"
$newLines = $lines[0..3644] + $pfLine + $lines[3645..($lines.Count-1)]
[System.IO.File]::WriteAllLines($repairFile, $newLines)

# Fix Customize.jsx - find adminNotes line in cancel block and insert after it
$lines = [System.IO.File]::ReadAllLines($custFile)
$adminNotesLine = ($lines | Select-String "Enhancement cancelled. Price restored to original." | Select-Object -First 1).LineNumber - 1
$newLines = $lines[0..$adminNotesLine] + $pfLine + $lines[($adminNotesLine+1)..($lines.Count-1)]
[System.IO.File]::WriteAllLines($custFile, $newLines)

Write-Output 'Done'
