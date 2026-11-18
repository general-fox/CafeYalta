import { QrCode } from 'lucide-react';
import { asset } from '../components';

const ink = 'var(--palette-midnight)';
const paper = 'var(--palette-paper)';
const clay = 'var(--palette-clay)';

function Scanner() {
  return <g>
    <g transform="rotate(-5 60 45)">
      <rect x="36" y="15" width="48" height="60" rx="2" fill={paper}/>
      <image href={asset('brand/Yalta.svg')} x="49" y="20" width="22" height="7"/>
      <QrCode x="43" y="31" size={34} stroke={ink} strokeWidth={1.5}/>
    </g>
    <path d="M25 34V23h11m48 0h11v11m0 22v11H84m-48 0H25V56" stroke={clay} strokeWidth="2.1"/>
    <path d="M29 49h62" stroke={clay} strokeWidth="1.4"/>
  </g>;
}

function PhoneScreen({ step }) {
  if (step === 2) {
    return <g>
      <path d="M46 36h28v14H54l-6 5v-5h-2z" fill={paper}/>
      <g stroke="none" fill={clay}>
        {[52, 57.5, 63, 68.5].map(x => <circle key={x} cx={x} cy="43" r="1.55"/>)}
      </g>
      <path d="M48 61h24" strokeWidth="1" opacity=".4"/>
    </g>;
  }
  if (step === 3) {
    return <g>
      <text x="47" y="36" fill={ink} stroke="none" fontFamily="var(--font-ui)" fontSize="5.8">Имя</text>
      <rect x="46" y="39" width="28" height="10" rx="1"/>
      <path d="M50 42v4" stroke={clay}/>
      <path d="M47 55h9m-9 5h25" strokeWidth="1" opacity=".45"/>
    </g>;
  }
  return <g>
    <rect x="46" y="40" width="28" height="19" rx="2" fill={ink}/>
    <path d="M49 50q2-2 4 0t4 0t4 0m-12 4q2-2 4 0t4 0t4 0" stroke={paper} strokeWidth="1"/>
    <circle cx="71" cy="38" r="6.5" fill={clay} stroke={paper}/>
    <path d="M68 38h6m-3-3v6" stroke={paper} strokeWidth="1.5"/>
  </g>;
}

export default function RegistrationIllustration({ step }) {
  return <svg className="lb-step-art" viewBox="0 0 120 90" width="120" height="90" fill="none" stroke={ink} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {step === 1 ? <Scanner/> : <g transform={step === 3 ? 'rotate(5 60 45)' : 'rotate(-5 60 45)'}>
      <rect x="39" y="6" width="42" height="78" rx="7" fill={paper}/>
      <path d="M55 11h10m-10 68h10"/>
      <image href={asset('brand/Yalta.svg')} x="49" y="18" width="22" height="7"/>
      <PhoneScreen step={step}/>
    </g>}
  </svg>;
}
