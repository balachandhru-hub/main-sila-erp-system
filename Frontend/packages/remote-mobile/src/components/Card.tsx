import React from 'react';

interface CardProps {
  title?: React.ReactNode;
  aside?: React.ReactNode;
  children?: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ title, aside, children }) => (
  <section className="sm-card">
    {(title || aside) && (
      <div className="sm-row">
        {title && <h2 className="sm-card__title">{title}</h2>}
        {aside}
      </div>
    )}
    {children}
  </section>
);

export default Card;
