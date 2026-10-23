import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  ArcElement, Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler);

const opts = { responsive: true, maintainAspectRatio: false };
const pct = { ...opts, scales: { y: { min: 0, max: 100, title: { display: true, text: '%' } } } };

export const BarChart = ({ labels, datasets }) => <div className="chart-box"><Bar data={{ labels, datasets }} options={pct} /></div>;
export const LineChart = ({ labels, datasets }) => <div className="chart-box"><Line data={{ labels, datasets }} options={pct} /></div>;
export const DonutChart = ({ labels, data, colors }) => (
  <div className="chart-box"><Doughnut data={{ labels, datasets: [{ data, backgroundColor: colors }] }} options={opts} /></div>
);
