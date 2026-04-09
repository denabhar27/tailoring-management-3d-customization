$repairFile = 'c:\Users\den-a\SE\tailoring-management-user\src\admin\repair.jsx'
$custFile = 'c:\Users\den-a\SE\tailoring-management-user\src\admin\Customize.jsx'

foreach ($file in @($repairFile, $custFile)) {
    $lines = [System.IO.File]::ReadAllLines($file)
    $pfLine = ($lines | Select-String "enhancementRequest: false, enhancementPendingAdminReview: false, addAccessories: false, accessoriesPrice: null, accessoriesDeclineReason: null" | Select-Object -First 1).LineNumber - 1
    $lines[$pfLine] = "                      pricingFactors: { ...pf2, enhancementRequest: false, enhancementPendingAdminReview: false, addAccessories: false, accessoriesPrice: null, accessoriesDeclineReason: null, amount_paid: String(originalPrice) },"
    [System.IO.File]::WriteAllLines($file, $lines)
}
Write-Output 'Done'
