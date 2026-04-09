$f = 'c:\Users\den-a\SE\backend\model\OrderModel.js'
$lines = [System.IO.File]::ReadAllLines($f)
# Line 954: change condition to also check it's not an accessories order
$lines[954] = '      if (pricingFactors.enhancementAdminAccepted === true && !pricingFactors.accessoriesPrice) {'
[System.IO.File]::WriteAllLines($f, $lines)
Write-Output 'Done'
