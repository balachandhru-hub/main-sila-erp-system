import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useGo } from '../navigation';

interface ScreenHeaderProps {
  title: string;
  /** Small upper-case line above the title (e.g. RECEIVE). */
  eyebrow?: string;
  /** Short explanation under the title. */
  intro?: string;
  /** Show a back button; goes back in history, or to `backTo` when given. */
  back?: boolean;
  backTo?: string;
  /** Right side of the top bar (e.g. the profile avatar). */
  aside?: React.ReactNode;
}

/** Top bar (back, brand) followed by the eyebrow and the screen title, like the SILA Store prototype. */
const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, eyebrow, intro, back = false, backTo, aside }) => {
  const navigate = useNavigate();
  const go = useGo();

  const onBack = () => {
    if (backTo) go(backTo);
    else navigate(-1);
  };

  return (
    <header>
      <div className="sm-topbar">
        {back || backTo ? (
          <button type="button" className="sm-header__back" aria-label="Back" onClick={onBack}>
            ←
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
        <span className="sm-brand" aria-label="SILA Store">
          SILA <span>Store</span>
        </span>
        {aside ?? <span aria-hidden="true" />}
      </div>
      <div className="sm-titleblock">
        {eyebrow && <span className="sm-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {intro && <p>{intro}</p>}
      </div>
    </header>
  );
};

export default ScreenHeader;
