import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface AnimatedRouteProps {
  children: ReactNode
}

function AnimatedRoute({ children }: AnimatedRouteProps): React.JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="h-full"
    >
      {children}
    </motion.div>
  )
}

export default AnimatedRoute
