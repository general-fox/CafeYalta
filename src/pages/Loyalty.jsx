import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Modal } from '../components';
import GuestCard from '../GuestCard';
import RegistrationIllustration from './RegistrationIllustration';

const registrationSteps = [
  { title: 'Откройте регистрацию', text: 'После запуска отсканируйте QR-код в кафе или нажмите кнопку под инструкцией.' },
  { title: 'Подтвердите номер', text: 'Введите номер телефона, затем код подтверждения из SMS.' },
  { title: 'Заполните анкету', text: 'Укажите имя и заполните обязательные поля, отмеченные звёздочкой.' },
  { title: 'Сохраните карту', text: 'Когда карта появится на экране, нажмите «Добавить», чтобы сохранить её в телефоне.' },
];

export default function Loyalty() {
  const [showLaunchNotice, setShowLaunchNotice] = useState(false);

  return <main className="loyalty-page loyalty-brand">
    <div className="container lb-guide">
      <Link className="lb-back" to="/" data-reveal="soft"><ArrowLeft size={16} aria-hidden="true"/>На главную</Link>
      <section id="get-card" aria-labelledby="loyalty-title">
        <div className="lb-intro">
          <div data-reveal-group>
            <span className="lb-kicker" data-reveal="rise">Программа лояльности</span>
            <h1 id="loyalty-title" data-reveal="rise">Как получить<br/>карту гостя</h1>
          </div>
          <div className="lb-card-preview" data-reveal="soft"><GuestCard/></div>
        </div>
        <ol className="lb-steps" aria-label="Шаги оформления карты" data-reveal-group>
          {registrationSteps.map(({ title, text }, index) => <li key={title} data-reveal="rise">
            <span className="lb-step-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <RegistrationIllustration step={index + 1}/>
            <div className="lb-step-copy"><h2>{title}</h2><p>{text}</p></div>
          </li>)}
        </ol>
        <button type="button" className="button lb-registration-action" data-reveal="soft" aria-haspopup="dialog" onClick={() => setShowLaunchNotice(true)}>
          Зарегистрироваться в программе лояльности <ArrowRight size={18} aria-hidden="true"/>
        </button>
      </section>
    </div>
    {showLaunchNotice && <Modal title="Оформление карты скоро откроется" onClose={() => setShowLaunchNotice(false)}>
      <p className="modal-intro">Когда программа лояльности заработает, здесь можно будет подтвердить номер телефона и получить карту гостя.</p>
      <button type="button" className="button" onClick={() => setShowLaunchNotice(false)}>Понятно</button>
    </Modal>}
  </main>;
}
