$f = 'c:\Users\den-a\SE\tailoring-management-user\src\user\Profile.jsx'
$lines = [System.IO.File]::ReadAllLines($f)
$lines[665] = '      const result = await requestEnhancement(itemToEnhance.order_item_id, notes, enhancePreferredDate || null, enhanceAddAccessories);'
[System.IO.File]::WriteAllLines($f, $lines)
Write-Output 'Done'
