import Viewer3D from './Viewer3D';

const OWN_MEASUREMENT_SECTIONS = [
    {
        title: 'Upper Garment',
        fields: [
            ['chest', 'Chest'],
            ['waist', 'Waist'],
            ['hips', 'Hips'],
            ['shoulders', 'Shoulders'],
            ['neckCircumference', 'Neck Circumference'],
            ['frontLength', 'Front Length'],
            ['backLength', 'Back Length'],
            ['sleeveLength', 'Sleeve Length'],
            ['armhole', 'Armhole'],
            ['bicep', 'Bicep']
        ]
    },
    {
        title: 'Lower Garment',
        fields: [
            ['inseam', 'Inseam'],
            ['outseam', 'Outseam'],
            ['rise', 'Rise'],
            ['thigh', 'Thigh']
        ]
    }
];

export default function ReviewPage({ garment, colors, fabric, pattern, style, measurements, personalization, userMeasurements, designImage, notes, onBack, onSubmit }) {

    const getPrice = () => {
        switch (fabric) {
            case 'silk': return 3000;
            case 'wool': return 2500;
            case 'linen': return 2700;
            case 'cotton': return 1000;
            default: return 3000;
        }
    };

    const price = getPrice();

    return (
        <div className="review-page" style={{ padding: 20, display: 'flex', flexDirection: 'column', height: '100vh', boxSizing: 'border-box' }}>
            <h2>Order Review</h2>

            <div style={{ flex: 1, display: 'flex', gap: 20 }}>
                <div style={{ flex: 1, border: '1px solid #ccc', borderRadius: 8, overflow: 'hidden' }}>
                    <Viewer3D
                        garment={garment}
                        colors={colors}
                        fabric={fabric}
                        pattern={pattern}
                        style={style}
                        measurements={measurements}
                        personalization={personalization}
                    />
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    <h3>Summary</h3>
                    <p><strong>Garment:</strong> {garment}</p>
                    <p><strong>Fabric:</strong> {fabric}</p>
                    <p><strong>Pattern:</strong> {pattern}</p>

                    {userMeasurements && Object.keys(userMeasurements).length > 0 && (
                        <div style={{ marginTop: 20 }}>
                            <strong>My Body Measurements</strong>
                            {OWN_MEASUREMENT_SECTIONS.map((section) => (
                                <div key={section.title} style={{ marginTop: 12, padding: 12, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fafafa' }}>
                                    <div style={{ fontWeight: 700, marginBottom: 8 }}>{section.title}</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                                        {section.fields.map(([fieldKey, label]) => (
                                            <div key={fieldKey} style={{ fontSize: 13 }}>
                                                <strong>{label}:</strong> {userMeasurements[fieldKey] !== undefined && userMeasurements[fieldKey] !== '' ? `${userMeasurements[fieldKey]} in` : '--'}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {designImage && (
                        <div style={{ marginTop: 20 }}>
                            <strong>Uploaded Design:</strong>
                            <img src={designImage} alt="Design" style={{ display: 'block', maxWidth: '100%', maxHeight: 200, marginTop: 10, borderRadius: 4 }} />
                        </div>
                    )}

                    {notes && (
                        <div style={{ marginTop: 20 }}>
                            <strong>Notes:</strong>
                            <p style={{ whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: 10, borderRadius: 4 }}>{notes}</p>
                        </div>
                    )}

                    <div style={{ marginTop: 30, padding: 20, background: '#e6f7ff', borderRadius: 8 }}>
                        <h3>Total Price</h3>
                        <div style={{ fontSize: 24, fontWeight: 'bold', color: '#0050b3' }}>
                            ₱ {price.toLocaleString()}
                        </div>
                        <small>Based on {fabric} fabric selection</small>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={onBack} style={{ padding: '10px 20px', background: '#f0f0f0', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Back to Edit</button>
                <button onClick={onSubmit} style={{ padding: '10px 20px', background: '#1890ff', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Submit Order</button>
            </div>
        </div>
    );
}
