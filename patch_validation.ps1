$custCtrl = 'c:\Users\den-a\SE\backend\controller\CustomizationController.js'
$orderCtrl = 'c:\Users\den-a\SE\backend\controller\OrderController.js'

# Fix CustomizationController line 176 (0-based = 175)
$lines = [System.IO.File]::ReadAllLines($custCtrl)
$lines[175] = '        const isCancellingEnhancement = updateData.pricingFactors && updateData.pricingFactors.enhancementRequest === false;'
$newLines = $lines[0..175] + '        if (isPriceChanged && !hasReason && !isCancellingEnhancement) {' + $lines[176..($lines.Count-1)]
# Remove old if line (was 176, now 177 after insert)
$newLines[177] = ''
[System.IO.File]::WriteAllLines($custCtrl, $newLines)

# Fix OrderController repair validation line 572 (0-based = 571)
$lines = [System.IO.File]::ReadAllLines($orderCtrl)
$lines[571] = '        const isCancellingEnhancement = updateData.pricingFactors && updateData.pricingFactors.enhancementRequest === false;'
$newLines2 = $lines[0..571] + '        if (isPriceChanged && !hasReason && !isCancellingEnhancement) {' + $lines[572..($lines.Count-1)]
$newLines2[573] = ''
[System.IO.File]::WriteAllLines($orderCtrl, $newLines2)

Write-Output 'Done'
