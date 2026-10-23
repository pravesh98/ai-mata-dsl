/**
 * @aimata-dsl/ui — src/components/Card.js
 *
 * DSL-first Card container primitive.
 */

const BASE_CLASSES = 'rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md';

const VARIANT_CLASSES = {
  default: 'border-gray-200',
  elevated: 'border-transparent shadow-lg hover:shadow-xl',
  outlined: 'border-gray-300 shadow-none hover:border-blue-400',
};

const PADDING_CLASSES = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

/**
 * Aimata-DSL Card component descriptor.
 */
export const Card = {
  /** Aimata micro-DSL signature for this component */
  dsl: '[Card.card{variant=default,padding=md}|children]',

  defaultProps: {
    variant: 'default',
    padding: 'md',
  },

  variantClasses: VARIANT_CLASSES,
  paddingClasses: PADDING_CLASSES,
  baseClasses: BASE_CLASSES,

  /**
   * Resolve the full className string for given props.
   * @param {{ variant?: string, padding?: string, className?: string }} props
   * @returns {string}
   */
  resolveClassName({ variant = 'default', padding = 'md', className = '' } = {}) {
    return [
      BASE_CLASSES,
      VARIANT_CLASSES[variant] || VARIANT_CLASSES.default,
      PADDING_CLASSES[padding] || PADDING_CLASSES.md,
      className,
    ]
      .filter(Boolean)
      .join(' ');
  },

  /**
   * Compress this component's usage to DSL.
   * @param {{ variant?: string, padding?: string, id?: string, children?: string }} props
   * @returns {string}
   */
  toDSL({ variant = 'default', padding = 'md', id, children = '' } = {}) {
    const classes = this.resolveClassName({ variant, padding });
    const classDots = classes.trim().split(/\s+/).join('.');
    const idPart = id ? `#${id}` : '';
    return `[div${idPart}.${classDots}|${children}]`;
  },
};

export default Card;
