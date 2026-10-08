import React from 'react';

/* Questionnaire building blocks, shared by every screen that shows template questions:
   template definitions (buyer admin), answer forms (supplier) and answer review (buyer).
   Each screen keeps its own data model and handlers; these components only own the layout,
   so questions look the same wherever they appear. Styles: `.sila-qa-*` in components.css. */

/* ------------------------------------------------------------------ List */

export interface QuestionListProps {
  children?: React.ReactNode;
  className?: string;
  'aria-label'?: string;
}

/** Numbered list of questions. Children are `QuestionItem`s. */
export const QuestionList: React.FC<QuestionListProps> = ({ children, className = '', ...rest }) => (
  <ol className={`sila-qa-list ${className}`.trim()} {...rest}>
    {children}
  </ol>
);

/* ------------------------------------------------------------------ Item */

export interface QuestionItemProps {
  /** 1-based position, shown as "Q1". */
  index: number;
  question: React.ReactNode;
  /** Human-readable type, e.g. "Single choice". */
  typeLabel?: string;
  required?: boolean;
  /** Id of the form control this question labels (renders a `<label htmlFor>`). */
  inputId?: string;
  /** Id for the question text, for `aria-labelledby` on grouped controls. */
  labelId?: string;
  /** Answer area: a form control, `QuestionAnswer`, or `QuestionOptions`. */
  children?: React.ReactNode;
  className?: string;
}

export const QuestionItem: React.FC<QuestionItemProps> = ({
  index,
  question,
  typeLabel,
  required = false,
  inputId,
  labelId,
  children,
  className = '',
}) => {
  const QuestionTag = inputId ? 'label' : 'div';
  return (
    <li className={`sila-qa-item ${className}`.trim()}>
      <div className="sila-qa-head">
        <span className="sila-qa-index" aria-hidden="true">Q{index}</span>
        <QuestionTag className="sila-qa-question" id={labelId} {...(inputId ? { htmlFor: inputId } : {})}>
          {question}
          {required && <span className="sila-visually-hidden"> (required)</span>}
        </QuestionTag>
        {(required || typeLabel) && (
          <span className="sila-qa-tags">
            {required && <span className="sila-badge sila-badge--sm sila-badge--danger">Required</span>}
            {typeLabel && <span className="sila-badge sila-badge--sm sila-badge--neutral">{typeLabel}</span>}
          </span>
        )}
      </div>
      {children && <div className="sila-qa-body">{children}</div>}
    </li>
  );
};

/* ------------------------------------------------------------------ Read-only answer */

export interface QuestionAnswerProps {
  /** The answer; empty strings, empty arrays and null count as unanswered. */
  value?: React.ReactNode | string[];
  emptyText?: string;
  /** Extra content after the answer, e.g. a "View file" button. */
  children?: React.ReactNode;
}

const isEmptyAnswer = (value: QuestionAnswerProps['value']) =>
  value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);

export const QuestionAnswer: React.FC<QuestionAnswerProps> = ({ value, emptyText = 'Not answered', children }) => {
  const empty = isEmptyAnswer(value) && !children;
  return (
    <div className={`sila-qa-answer${empty ? ' sila-qa-answer--empty' : ''}`}>
      {empty ? (
        emptyText
      ) : (
        <>
          {Array.isArray(value) ? (
            <ul className="sila-qa-chips">
              {value.map((item) => (
                <li key={item} className="sila-qa-chip">{item}</li>
              ))}
            </ul>
          ) : (
            !isEmptyAnswer(value) && <span className="sila-qa-answer-text">{value}</span>
          )}
          {children}
        </>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ Option preview */

/** The choices a question offers, shown as chips (template definitions). */
export const QuestionOptions: React.FC<{ options: string[]; label?: string }> = ({ options, label = 'Options' }) =>
  options.length === 0 ? null : (
    <div className="sila-qa-options">
      <span className="sila-qa-options-label">{label}</span>
      <ul className="sila-qa-chips">
        {options.map((option) => (
          <li key={option} className="sila-qa-chip">{option}</li>
        ))}
      </ul>
    </div>
  );

/* ------------------------------------------------------------------ Choice controls */

export interface ChoiceGroupProps {
  type: 'radio' | 'checkbox';
  labelledBy?: string;
  children?: React.ReactNode;
}

/** Wraps `Choice`s with the right ARIA role for a radio or checkbox group. */
export const ChoiceGroup: React.FC<ChoiceGroupProps> = ({ type, labelledBy, children }) => (
  <div className="sila-choice-group" role={type === 'radio' ? 'radiogroup' : 'group'} aria-labelledby={labelledBy}>
    {children}
  </div>
);

export interface ChoiceProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  type: 'radio' | 'checkbox';
  label: React.ReactNode;
}

/** One selectable option, rendered as a bordered row that highlights when checked. */
export const Choice: React.FC<ChoiceProps> = ({ type, label, className = '', ...input }) => (
  <label className={`sila-choice ${className}`.trim()}>
    <input type={type} {...input} />
    <span>{label}</span>
  </label>
);

/* ------------------------------------------------------------------ Progress */

/** "3 of 5 answered" — turns green when everything is answered. */
export const QuestionProgress: React.FC<{ answered: number; total: number }> = ({ answered, total }) => (
  <span className={`sila-badge sila-badge--sm ${answered >= total ? 'sila-badge--success' : 'sila-badge--neutral'}`}>
    {answered} of {total} answered
  </span>
);
