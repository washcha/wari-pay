import ReactGA from 'react-ga4'

export const initGA = () => ReactGA.initialize('G-9KDQJ2XFPW')

export const track = (eventName, params) => ReactGA.event(eventName, params)
