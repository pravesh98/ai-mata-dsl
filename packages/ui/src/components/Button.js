/**
 * @aimata-dsl/ui — src/components/Button.js
 *
 * DSL-first Button primitive.
 * Exposes a `.dsl` static property for tooling/introspection.
 */

/**
 * @typedef {Object} ButtonProps
 * @property {'primary'|'secondary'|'ghost'|'danger'} [variant]
 * @property {'sm'|'md'|'lg'} [size]
 * @property {boolean} [disabled]
 * @property {string} [className]
 * @property {Function} [onClick]
 * @property {import('react').ReactNode} [children]
 */

const VARIANT_CLASSES = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
  secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-400',
  ghost: 'bg-transparent text-blue-600 hover:bg-blue-50 focus:ring-blue-500',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
};

const SIZE_CLASSES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
};

const BASE_CLASSES =
  'inline-flex items-center justify-center rounded-md font-medium transition-colors ' +
  'focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

/**
 * Aimata-DSL Button component.
 * This is framework-agnostic metadata — actual rendering requires React.
 *
 * @type {{ dsl: string, defaultProps: ButtonProps, variantClasses: typeof VARIANT_CLASSES, sizeClasses: typeof SIZE_CLASSES, baseClasses: string }}
 */
export const Button = {
  /** Aimata micro-DSL signature for this component */
  dsl: '[Button.btn{variant=primary,size=md}|children]',

  defaultProps: {
    variant: 'primary',
    size: 'md',
    disabled: false,
  },

  variantClasses: VARIANT_CLASSES,
  sizeClasses: SIZE_CLASSES,
  baseClasses: BASE_CLASSES,

  /**
   * Resolve the full className string for given props.
   * @param {{ variant?: string, size?: string, className?: string }} props
   * @returns {string}
   */
  resolveClassName({ variant = 'primary', size = 'md', className = '' } = {}) {
    return [
      BASE_CLASSES,
      VARIANT_CLASSES[variant] || VARIANT_CLASSES.primary,
      SIZE_CLASSES[size] || SIZE_CLASSES.md,
      className,
    ]
      .filter(Boolean)
      .join(' ');
  },

  /**
   * Compress this component's usage to DSL.
   * @param {{ variant?: string, size?: string, children?: string, onClick?: string }} props
   * @returns {string}
   */
  toDSL({ variant = 'primary', size = 'md', children = 'Click', onClick } = {}) {
    const classes = this.resolveClassName({ variant, size });
    const classDots = classes.trim().split(/\s+/).join('.');
    const props = onClick ? `{onClick=${onClick}}` : '';
    return `[button.${classDots}${props}|${children}]`;
  },
};

export default Button;
