$f = 'c:\Users\den-a\SE\tailoring-management-user\src\user\Profile.jsx'
$lines = [System.IO.File]::ReadAllLines($f)

# 1. Add state after line 44 (submittingEnhancement)
$stateInsert = @(
  '  const [declineReasonModalOpen, setDeclineReasonModalOpen] = useState(false);',
  '  const [declineReasonText, setDeclineReasonText] = useState('''');',
  '  const [itemToDecline, setItemToDecline] = useState(null);',
  '  const [submittingDecline, setSubmittingDecline] = useState(false);'
)
$lines = $lines[0..44] + $stateInsert + $lines[45..($lines.Count-1)]
[System.IO.File]::WriteAllLines($f, $lines)

# 2. Replace handleDeclinePrice to open modal for accessories, direct confirm for regular
$lines = [System.IO.File]::ReadAllLines($f)
$startLine = ($lines | Select-String '  const handleDeclinePrice = async \(item\)' | Select-Object -First 1).LineNumber - 1
$endLine = ($lines | Select-String '  const closeDetailsModal' | Select-Object -First 1).LineNumber - 2

$newHandler = @(
  '  const handleDeclinePrice = async (item) => {',
  '    const pricingFactors = item.pricing_factors || {};',
  '    const isAccessoriesDecline = pricingFactors.addAccessories === true && pricingFactors.enhancementRequest === true;',
  '    if (isAccessoriesDecline) {',
  '      setItemToDecline(item);',
  '      setDeclineReasonText('''');',
  '      setDeclineReasonModalOpen(true);',
  '      return;',
  '    }',
  '    const isConfirmed = await confirm(',
  '      ''Declining the updated price will cancel this order. Do you want to continue?'',',
  '      ''Confirm Price Decline'', ''warning'',',
  '      { confirmText: ''Decline Price'', cancelText: ''Keep Order'' }',
  '    );',
  '    if (!isConfirmed) return;',
  '    await submitDeclinePrice(item, '''');',
  '  };',
  '',
  '  const submitDeclinePrice = async (item, reason) => {',
  '    try {',
  '      setSubmittingDecline(true);',
  '      const response = await fetch(`${API_URL}/orders/${item.order_item_id}/decline-price`, {',
  '        method: ''POST'',',
  '        headers: { ''Content-Type'': ''application/json'', ''Authorization'': `Bearer ${localStorage.getItem(''token'')}` },',
  '        body: JSON.stringify({ reason })',
  '      });',
  '      const result = await response.json();',
  '      if (result.success) {',
  '        if (result.isAccessoriesDecline) {',
  '          await alert(''Accessories price declined. The admin will review and adjust.'', ''Success'', ''success'');',
  '        } else {',
  '          await alert(''Price declined. Your order has been cancelled.'', ''Success'', ''success'');',
  '        }',
  '        const ordersResult = await getUserOrderTracking();',
  '        if (ordersResult.success) setOrders(ordersResult.data);',
  '      } else {',
  '        await alert(result.message || ''Failed to decline price'', ''Error'', ''error'');',
  '      }',
  '    } catch (error) {',
  '      await alert(''Error declining price. Please try again.'', ''Error'', ''error'');',
  '    } finally {',
  '      setSubmittingDecline(false);',
  '    }',
  '  };'
)

$newLines = $lines[0..($startLine-1)] + $newHandler + $lines[($endLine+1)..($lines.Count-1)]
[System.IO.File]::WriteAllLines($f, $newLines)
Write-Output 'Done'
