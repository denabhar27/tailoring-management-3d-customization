$f = 'c:\Users\den-a\SE\tailoring-management-user\src\admin\Customize.jsx'
$lines = [System.IO.File]::ReadAllLines($f)

# 1. Add state variables after line 84 (savingEnhancementPrice)
$lines[84] = '  const [savingEnhancementPrice, setSavingEnhancementPrice] = useState(false);'
$stateInsert = @(
  '  const [showAccessoriesPriceModal, setShowAccessoriesPriceModal] = useState(false);',
  '  const [accessoriesPriceItem, setAccessoriesPriceItem] = useState(null);',
  '  const [accessoriesPrice, setAccessoriesPrice] = useState('''');'
)
$lines = $lines[0..84] + $stateInsert + $lines[85..($lines.Count-1)]

# Re-read line numbers after insertion (+3 lines)
$lines = [System.IO.File]::ReadAllLines($f)
[System.IO.File]::WriteAllLines($f, ($lines[0..84] + $stateInsert + $lines[85..($lines.Count-1)]))
$lines = [System.IO.File]::ReadAllLines($f)

# 2. Fix amountPaid at block 1 (was 493/495, now 496/498 after +3)
$lines[496] = '      const isEnhancementOrder = pricingFactors.enhancementRequest && pricingFactors.enhancementAdminAccepted;'
$lines[497] = '      const isAccessoriesEnhancement = isEnhancementOrder && !!pricingFactors.accessoriesPrice;'
$lines[498] = '      const amountPaid = (isEnhancementOrder && !isAccessoriesEnhancement) ? parseFloat(item.final_price || 0) : parseFloat(pricingFactors.amount_paid || 0);'

# 3. Fix amountPaid at block 2 (was 2594/2596, now 2597/2599 after +3)
$lines[2600] = '      const isEnhancementOrder = pricingFactors.enhancementRequest && pricingFactors.enhancementAdminAccepted;'
$lines[2601] = '      const isAccessoriesEnhancement = isEnhancementOrder && !!pricingFactors.accessoriesPrice;'
$lines[2602] = '      const amountPaid = (isEnhancementOrder && !isAccessoriesEnhancement) ? parseFloat(item.final_price || 0) : parseFloat(pricingFactors.amount_paid || 0);'

# 4. Fix amountPaid at block 3 (was 3839/3841, now 3842/3844 after +3)
$lines[3845] = '                  const isEnhancementOrder = pricingFactors.enhancementRequest && pricingFactors.enhancementAdminAccepted;'
$lines[3846] = '                  const isAccessoriesEnhancement = isEnhancementOrder && !!pricingFactors.accessoriesPrice;'
$lines[3847] = '                  const amountPaid = (isEnhancementOrder && !isAccessoriesEnhancement) ? parseFloat(item.final_price || 0) : parseFloat(pricingFactors.amount_paid || 0);'

[System.IO.File]::WriteAllLines($f, $lines)
Write-Output 'Step1 Done'
