$f = 'c:\Users\den-a\SE\tailoring-management-user\src\user\Profile.jsx'
$lines = [System.IO.File]::ReadAllLines($f)
# Line 663 is '' (empty), line 664 is the result line missing try{ and setSubmittingEnhancement
# Replace lines 663-664 with the correct block
$newLines = $lines[0..662] + @(
  '',
  '    try {',
  '      setSubmittingEnhancement(true);',
  '      const result = await requestEnhancement(itemToEnhance.order_item_id, notes, enhancePreferredDate || null, enhanceAddAccessories);'
) + $lines[664..($lines.Count-1)]
[System.IO.File]::WriteAllLines($f, $newLines)
Write-Output 'Done'
