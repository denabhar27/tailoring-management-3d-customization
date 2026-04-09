$f = 'c:\Users\den-a\SE\backend\model\CustomizationModel.js'
$lines = [System.IO.File]::ReadAllLines($f)
$lines[149] = '      if (pricingFactors.enhancementAdminAccepted === true && !pricingFactors.accessoriesPrice) {'
[System.IO.File]::WriteAllLines($f, $lines)
Write-Output 'Done'
