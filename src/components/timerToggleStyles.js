export const getTimerToggleProps = (darkMode, disabled = false) => ({
  className: `!h-6 !w-11 !border-0 shadow-sm transition-colors ${darkMode
    ? 'data-[state=checked]:bg-blue-500 data-[state=unchecked]:bg-gray-600'
    : 'data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-gray-300'
  } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`,
  thumbClassName: '!h-5 !w-5 data-[state=checked]:!translate-x-[22px] data-[state=unchecked]:!translate-x-[2px]',
});
