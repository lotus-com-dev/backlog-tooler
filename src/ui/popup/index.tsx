import ReactDOM from 'react-dom/client';
import { PopupComponent } from '@/ui/popup/popup';
import '@/ui/popup/popup.css';

const root = ReactDOM.createRoot(document.getElementById('popup-root') as HTMLElement);
root.render(<PopupComponent />);